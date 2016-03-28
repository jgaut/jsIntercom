var app = require('express')();
var serverIo = require('http').createServer(app);
var io = require('socket.io')(serverIo);
var portIo = 3000;
var HashMap = require('hashmap');
var map = new HashMap();
var request = require('request');
var gpio = require('rpi-gpio');
var async = require('async'); 
var log4js = require('log4js');
//var logger = log4js.getLogger();

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('intercom.log'), 'intercom');
 
var logger = log4js.getLogger('intercom');
logger.setLevel('DEBUG');

var PropertiesReader = require('properties-reader');
var properties = PropertiesReader('properties.file');)

logger.debug('Start init!');

var isNumeric = require("isnumeric");

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
  	gpio.write(7, true, function(err) {
        if (err) throw err;
        logger.debug('Written to pin');
    });
});

serverIo.listen(portIo);
//logger.debug(serverIo);


gpio.on('change', function(channel, value) {
    if(channel==12 && value){
        logger.debug('Channel ' + channel + ' value is now ' + value);
        dateNow = new Date();
        if(dateRef<dateNow){

                        //Auto open door
            logger.debug(dateNow+" < "+dateAuto+" ?");
            if(dateNow<dateAuto){
                opendoor();
                logger.debug('autoopendoor !');
            }
            dateAuto = new Date();
            logger.debug('reset date autoopendoor : '+dateAuto);

            
            logger.debug(dateRef+" < "+dateNow+" ? true");
    	   request(properties.get('ifttt.url')+properties.get('ifttt.key'), function (error, response, body) {
  		    if (!error && response.statusCode == 200) {
    			logger.debug(body) // Show the HTML for the Google homepage. 
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
//|  17 |   0 | GPIO. 0 |   IN | 0 | 11 || 12 | 0 | IN   | GPIO. 1 | 1     | 18  |
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

//Colonne wPi
var pin7 = 7; //Detection de sonnerie
var pin16 = 16; //Sortie ouverture porte
var pin12 = 12; //Entree ouverture porte

//Init des dates
var dateRef = new Date();
var dateAuto = new Date();
var dateNow;

async.parallel([
    function(callback) {
        gpio.setup(pin7, gpio.DIR_OUT, callback)
    },
    function(callback) {
        gpio.setup(pin16, gpio.DIR_OUT, callback)
    },
    function(callback) {
        //Ecoute pour la sonnerie
        gpio.setup(pin12, gpio.DIR_IN, gpio.EDGE_BOTH, callback)
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
	   //logger.debug(pin);
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
    opendoor();
    res.send();
});

function opendoor(){
    setTimeout(function() {
        gpio.write(pin7, 1, off);
        logger.debug(pin7+" : on");
    }, 1000);
}

function off() {
    setTimeout(function() {
        gpio.write(pin7, 0, null);
        logger.debug(pin7+" : off");
    }, 1000);
};

app.get('/autoopendoor/:open/:duration', function(req, res) {
    logger.debug('open : '+req.params.open + '; duration : '+req.params.duration);
    if(!isNumeric(req.params.duration) || !isNumeric(req.params.open) || req.params.open!=0 && req.params.open!=1){
        logger.debug('Wrong request !'); res.status(404).send('Wrong request !');
    }else{
        dateAuto = new Date(new Date().getTime() + (1000 * 60 * req.params.duration));
        logger.debug('date autoopendoor : ' + dateAuto);
    }
    res.send();
});

logger.debug('End init!');
