var app = require('express')();
var https = require('https');
var io = require('socket.io')(https);
var HashMap = require('hashmap');
var request = require('request');
var gpio = require('rpi-gpio');
var async = require('async'); 
var log4js = require('log4js');
var isNumeric = require("isnumeric");
var PropertiesReader = require('properties-reader');
var fs = require('fs');
var exec = require('child_process').exec;
var dateFormat = require('dateformat');
var mkdirp = require('mkdirp');

var map = new HashMap();
var cmdRecord = 'arecord -f dat -D plughw:1,0 -d';
var ringFlag=0;

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('intercom.log'), 'intercom');
 
var logger = log4js.getLogger('intercom');
var propertiesFile = PropertiesReader('properties.file');
logger.setLevel(propertiesFile.get('log.level'));
var port = propertiesFile.get('basic.port');
var keyFile = PropertiesReader('key.file');

var privateKey  = fs.readFileSync(propertiesFile.get('ssl.key'));
var certificate = fs.readFileSync(propertiesFile.get('ssl.crt'));
var credentials = { key: privateKey, cert: certificate };
credentials.agent = new https.Agent(credentials);
https.createServer(credentials, app).listen(port, function(){
    logger.log('Server open on port '+ port);
});

logger.debug('Start init!');

mkdirp(propertiesFile.get('record.directory'), function(err) { 
    logger.debug(err);
});


var soc;

io.on('connection', function(socket){
    //logger.debug(socket);
    soc=socket;
    logger.debug('io connection');
    soc.on('message', function (data) {
        logger.debug('message :'+data);
    });
    soc.on('disconnect', function () {
        logger.debug('io disconnection');
    });
});      

//socket.emit('whoami', { id: id, name: nameT.value, lieu: locationT.value, role: 'T' });
/*socket.on('whoami', function(data){
    logger.debug('id :'+data.id);
    logger.debug('name : '+data.name);
    logger.debug('lieu : '+data.lieu);
    logger.debug('role : '+data.role);
    map.set(data.id, data);
    //logger.debug(map);
    io.emit('list',map);
  });*/

//https.listen(port);

gpio.on('change', function(channel, value) {

    logger.debug('Channel ' + channel + ' = ' + value +' & ringFlag = '+ringFlag);
    //Le canal 12 sert pour la détection de la sonnerie
    if(channel==12 && value && ringFlag==0){
        
        //Protection contre les sonneries trop proches
        //if(dateRef<dateNow){

        //Verrouillage du traitement de l'appel
        ringFlag=1;

        //Appel de la fonction de gestion de la sonnerie
        ring();

        setTimeout(
        	function() {
	        	ringFlag=0;
	    	}, propertiesFile.get('ring.minBtw2ring')*1000
	    );

	} else if(channel==12 && !value && ringFlag==1){
		//Verrouillage de l'enregistrement
        ringFlag=2;
        //Lancement de l'enregistrement
    	if(propertiesFile.get('record.flag')){
    		record(propertiesFile.get('record.duration'));
    	}
	}
});

function ring(){

    //Appel des smartphones
    if(soc){
        soc.emit('ring', '');
    }

	//Auto open door
	if(propertiesFile.get('autoopendoor.flag')){
		dateNow = new Date();
	    if(dateNow<dateAuto){
	        opendoor();
	        logger.debug("autoopendoor: "+dateNow+" < "+dateAuto+" ? true => Open door !");
	        dateAuto = dateNow;
	        logger.debug('reset date autoopendoor : '+dateAuto);
	        switchOn(1000);
	        logger.debug('activation de l interphone classique');
	    }else{
	        logger.debug("autoopendoor: "+dateNow+" < "+dateAuto+" ? false");
	    }
	}
    
   //Appel du service IFTTT
   if(propertiesFile.get('ifttt.flag')){
	   logger.debug("Call IFTTT Channel Maker 'ring'");
	   logger.debug(propertiesFile.get('ifttt.url.ring')+keyFile.get('ifttt.key'));
	    request(propertiesFile.get('ifttt.url.ring')+keyFile.get('ifttt.key'), function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	            logger.debug(body) // Show the HTML for the IFTTT respons. 
	        }else{
	            logger.debug(error);
	        }
	    });
	}

};

//+-----+-----+---------+------+---+--B Plus--+---+------+---------+-----+-----+
//| BCM | wPi |   Name  | Mode | V | Physical | V | Mode | Name    | wPi | BCM |
//+-----+-----+---------+------+---+----++----+---+------+---------+-----+-----+
//|     |     |    3.3v |      |   |  1 || 2  |   |      | 5v      |     |     |
//|   2 |   8 |   SDA.1 |   IN | 1 |  3 || 4  |   |      | 5V      |     |     |
//|   3 |   9 |   SCL.1 |   IN | 1 |  5 || 6  |   |      | 0v      |     |     |
//|   4 |   7 | GPIO. 7 |  OUT | 0 |  7 || 8  | 1 | ALT0 | TxD     | 15  | 14  |
//|     |     |      0v |      |   |  9 || 10 | 1 | ALT0 | RxD     | 16  | 15  |
//|  17 |   0 | GPIO. 0 |   IN | 0 | 11 || 12 | 0 | IN   | GPIO. 1 | 1   | 18  |
//|  27 |   2 | GPIO. 2 |   IN | 0 | 13 || 14 |   |      | 0v      |     |     |
//|  22 |   3 | GPIO. 3 |   IN | 0 | 15 || 16 | 1 | OUT  | GPIO. 4 | 4   | 23  |
//|     |     |    3.3v |      |   | 17 || 18 | 0 | IN   | GPIO. 5 | 5   | 24  |
//|  10 |  12 |    MOSI |   IN | 0 | 19 || 20 |   |      | 0v      |     |     |
//|   9 |  13 |    MISO |   IN | 0 | 21 || 22 | 0 | IN   | GPIO. 6 | 6   | 25  |
//|  11 |  14 |    SCLK |   IN | 0 | 23 || 24 | 1 | IN   | CE0     | 10  | 8   |
//|     |     |      0v |      |   | 25 || 26 | 1 | IN   | CE1     | 11  | 7   |
//|   0 |  30 |   SDA.0 |   IN | 1 | 27 || 28 | 1 | IN   | SCL.0   | 31  | 1   |
//|   5 |  21 | GPIO.21 |   IN | 1 | 29 || 30 |   |      | 0v      |     |     |
//|   6 |  22 | GPIO.22 |   IN | 1 | 31 || 32 | 0 | IN   | GPIO.26 | 26  | 12  |
//|  13 |  23 | GPIO.23 |   IN | 0 | 33 || 34 |   |      | 0v      |     |     |
//|  19 |  24 | GPIO.24 |   IN | 0 | 35 || 36 | 0 | IN   | GPIO.27 | 27  | 16  |
//|  26 |  25 | GPIO.25 |   IN | 0 | 37 || 38 | 0 | IN   | GPIO.28 | 28  | 20  |
//|     |     |      0v |      |   | 39 || 40 | 0 | IN   | GPIO.29 | 29  | 21  |
//+-----+-----+---------+------+---+----++----+---+------+---------+-----+-----+
//| BCM | wPi |   Name  | Mode | V | Physical | V | Mode | Name    | wPi | BCM |
//+-----+-----+---------+------+---+--B Plus--+---+------+---------+-----+-----+

//Colonne Physical 
var pin7 = 7; //Ouverture porte -> DIP05-2A72-21D
var pin16 = 16; //Detection de sonnerie OUT
var pin12 = 12; //Detection de sonnerie IN 
var pin13 = 13; //Mise hors service interphone classique -> DIP05-1C90-51D

//Init des dates
//var dateRef = new Date();
var dateAuto = new Date();
var dateNow;

async.parallel([
    function(callback) {
        gpio.setup(pin7, gpio.DIR_OUT, callback);
        logger.debug('pin7 set OUT');
    },
        function(callback) {
        gpio.setup(pin13, gpio.DIR_OUT, callback);
        logger.debug('pin13 set OUT');
    },
    function(callback) {
        gpio.setup(pin16, gpio.DIR_OUT, callback);
        logger.debug('pin16 set OUT');
    },
    function(callback) {
        //Ecoute pour la sonnerie
        gpio.setup(pin12, gpio.DIR_IN, gpio.EDGE_BOTH, callback);
        logger.debug('pin12 set IN');
    }
], function(err, results) {
    logger.debug('Pins set up');
    write();
});
 
function write() {
    async.series([
        function(callback) {
            delayedWrite(pin7, false, callback);
            logger.debug('write pin7 false');
        },
        function(callback) {
            delayedWrite(pin13, false, callback);
            logger.debug('write pin13 false');
        },
        function(callback) {
            delayedWrite(pin16, true, callback);
            logger.debug('write pin16 true');
        }
    ], function(err, results) {
        logger.debug('Writes complete');
        logger.debug("Error : "+err);
        logger.debug("Results "+results);
    });
};
 
function delayedWrite(pin, value, callback) {
    setTimeout(function() {
        gpio.write(pin, value, callback);
    }, 5000);
};

/*
app.get('/wines/:id', function(req, res) {
    res.send({id:req.params.id, name: "The Name", description: "description"});
});
*/

 /* serves main page */
app.get("/", function(req, res) {
    logger.debug('uv4l/index.html');
    res.sendfile('uv4l/index.html');
 });

app.get("/js/gyronorm.js", function(req, res) {
    res.sendfile('uv4l/js/gyronorm.js');
 });

app.get('/testRecord', function(req, res) {
	record(10);
	res.send('OK');
});

app.get('/opendoor', function(req, res) {
    logger.debug('opendoor');
    opendoor();
    res.send('OK');
});

app.get('/ring', function(req, res) {
    logger.debug('ring');
    ring();
    res.send('OK');
});

function opendoor(){
    setTimeout(function() {
        gpio.write(pin7, 1, closedoor);
        logger.debug(pin7+" : opendoor");
    }, 1000);
}

function closedoor() {
    setTimeout(function() {
        gpio.write(pin7, 0, null);
        logger.debug(pin7+" : closedoor");
        //Appel du service IFTTT
        logger.debug("Call IFTTT Channel Maker 'opendoor'");
        logger.debug(propertiesFile.get('ifttt.url.opendoor')+keyFile.get('ifttt.key'));
        request(propertiesFile.get('ifttt.url.opendoor')+keyFile.get('ifttt.key'), function (error, response, body) {
            if (!error && response.statusCode == 200) {
                logger.debug(body) // Show the HTML for the IFTT response. 
            }else{
                logger.debug(error);
            }
        });
    }, 1000);
};

function switchOff(duration){
    setTimeout(function() {
        gpio.write(pin13, 1, switchOn(duration));
        logger.debug(pin13+" : switchOff");
    }, 1000);
}

function switchOn(duration){
    setTimeout(function() {
        gpio.write(pin13, 0, null);
        logger.debug(pin13+" : switchOn");
    }, duration);
}

function record(duration){
    logger.debug('Tentative d enregistrement');
    exec(cmdRecord + ' ' + duration + ' ' + propertiesFile.get('record.directory') + '/' + dateFormat(new Date(), 'yyyymmddhhMMss')+'.wav', function(error, stdout, stderr) {
        logger.debug(stdout);
        logger.debug(stderr);
        logger.debug(error);
    });
}

app.get('/autoopendoor/:duration', function(req, res) {
    logger.debug('autoopendoor => duration : '+req.params.duration);
    if(!isNumeric(req.params.duration)){
        logger.debug('Wrong request !'); res.status(404).send('Wrong request !');
    }else{
        //On décale la date d'ouverture auto à now + duration.
        var duration = 1000 * 60 * req.params.duration;
        dateAuto = new Date(new Date().getTime() + (duration));
        logger.debug('date autoopendoor : ' + dateAuto);
        //On met sur silence l'interphone classique.
        logger.debug('interphone classique sous silence pour ' + duration +' ms');
        switchOff(duration);
    }
    res.send('OK');
});

logger.debug('End init!');
