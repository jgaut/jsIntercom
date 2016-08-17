var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = 8080;

var HashMap = require('hashmap');
var map = new HashMap();
var request = require('request');
var gpio = require('rpi-gpio');
var async = require('async'); 
var log4js = require('log4js');
var isNumeric = require("isnumeric");
var PropertiesReader = require('properties-reader');

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('intercom.log'), 'intercom');
 
var logger = log4js.getLogger('intercom');
//logger.setLevel('DEBUG');

var properties = PropertiesReader('properties.file');
logger.setLevel(properties.get('log.level'));

logger.debug('Start init!');



io.on('connection', function(socket){
  logger.debug(socket);
  logger.debug('connection !');
});


io.on('disconnect', function(){
	logger.debug('socket server disconnect');
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

io.on('opendoor', function(){
  	logger.debug('opendoor');
  	opendoor();
});

server.listen(port);

gpio.on('change', function(channel, value) {

    //Le canal 12 sert pour la détection de la sonnerie
    if(channel==12 && value){
        logger.debug('Channel ' + channel + ' value is now ' + value);
        dateNow = new Date();

        //Protection contre les sonneries trop proches
        if(dateRef<dateNow){
            
            //Auto open door ?
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

            //Appel du service IFTTT
    	   request(properties.get('ifttt.url.ring')+properties.get('ifttt.key'), function (error, response, body) {
  		    if (!error && response.statusCode == 200) {
    			logger.debug(body) // Show the HTML for the IFTT respons. 
  			}else{
                logger.debug(error);
            }
		  });

           //Next accepted ring after 5 sec minimum
            dateRef = new Date(new Date().getTime() + (1000 * 5));


        }else{
            //logger.debug("false");
        }
	} 
});

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
var pin7 = 7; //Ouverture porte
var pin16 = 16; //Detection de sonnerie OUT
var pin12 = 12; //Detection de sonnerie IN 
var pin13 = 13; //Mise hors service interphone classique
 
//Init des dates
var dateRef = new Date();
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
        logger.debug(err);
        logger.debug(results);
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

app.get('/test', function(req, res) {
    res.send('OK');
});

app.get('/opendoor', function(req, res) {
    logger.debug('opendoor');
    opendoor();
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
        request(properties.get('ifttt.url.opendoor')+properties.get('ifttt.key'), function (error, response, body) {
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
