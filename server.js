var app = require('express')();
var serverIo = require('http').createServer(app);
var io = require('socket.io')(serverIo);
var portIo = 3000;

var HashMap = require('hashmap');
var map = new HashMap();

var request = require('request');
var gpio = require('rpi-gpio');
//var gpio = require("gpio");
var async = require('async'); 
var log4js = require('log4js');

var log4js = require('log4js'); 
//var logger = log4js.getLogger();

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('intercom.log'), 'intercom');
 
var logger = log4js.getLogger('intercom');
logger.setLevel('DEBUG');

var PropertiesReader = require('properties-reader');
var properties = PropertiesReader('properties.file');

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
    	   request('https://maker.ifttt.com/trigger/ringIntercomNotif/with/key/'+properties.get('main.ifttt.key'), function (error, response, body) {
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

var pin7 = 7;
var pin16 = 16;
var pin12 = 12;
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

app.get('/autoopendoor', function(req, res) {
    dateAuto = new Date(new Date().getTime() + (1000 * 60 * 5));
    logger.debug('date autoopendoor : ' + dateAuto);
    res.send();
});

logger.debug('End init!');
