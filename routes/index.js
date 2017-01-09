var express = require('express');
var winston = require('winston');
var logger = require('morgan');
var querystring = require('querystring');
var router = express.Router();

// connect to AirTable
const Airtable = require('airtable');

// test version (on personal account)
// var base = new Airtable({ apiKey: 'keyYzUutxaILiEMpV' }).base('appfZ6MLegSzjsN1i');
// production version
var base = new Airtable({ apiKey: 'key75Nk9vOTp0ZARs' }).base('appwNiKTDHNEGFDWY');

// functions to handle POST data
// yesNoCheck fills out checkboxes in Airtable, returns true only if Yes is selected 
function yesNoCheck(s) {
    if (s == "yes" || s == "Yes") {
	return true;
    }
    else {
	return false;
    }
}

// handles multiselect (checkboxes)
// if we have selected only one option, JotForm gives us a string
// in this case, we need to convert it to an object (array of size 1)
function multiSelect(s) {
    if (typeof(s) == "string") {
	return([s]);
    } else {
	return s
    }
}

// deletes null or empty string elements from data object
// generally empty responses here will be "" or []
function delete_null_properties(test, recurse) {
    for (var i in test) {
        if (test[i] === null || test[i] === [] || test[i] === undefined || test[i] === '' ) {
            delete test[i];
        } else if (recurse && typeof test[i] === 'object') {
            delete_null_properties(test[i], recurse);
        }
    }
}

// sync with AirTable
function syncAirTable(data, date) {
    // remove blank and null fields from data
    delete_null_properties(data, true);
    // search for record based on name and email
    // use email also in case two people have the same name
    formula = '(AND(Name="'+data.Name+'",Email="'+data.Email+'"))';
    base('Campers').select({
        maxRecords: 5,
	filterByFormula: formula
    }).firstPage(function(error, records) {
        if (error) {
	    winston.info(error);
	} else {
	    records.forEach(function(record) {
	        winston.info('Retrieved ', record.get('Name'));
	    });
	    winston.info('Number of matching records: ', records.length);
	    // if we have exactly 1 match, then we update it
	    if (records.length == 1) {
	        id = records[0].id;
		winston.info('Found matching record ID ', id);
		base('Campers').update(id, data, function(err, record) {
		    if (err) { 
		        winston.info('Error in updating: ',err); 
		    } else {
		        winston.info('Updated record: ',record);
		    }
		});
	    }
	    // otherwise we insert a new record
	    else {
		// only put the application timestamp in when the record is created
		data["Application timestamp"] = date.toUTCString();
		base('Campers').create(data, function(err, record) {
		    if (err) {
		        winston.info('Error in creating: ',err);
			winston.info(data);
		    } else {
			winston.info('Inserting new record for ',data.Name,', ',data.Email); 
			winston.info('New record: ',record);
		    }
		});
     	    }
	}
    });
}

/* GET home page (base) */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// POST method for PW application
router.post('/apply', function (req, res) {
    //res.send(JSON.stringify(req.body, null, 4));
  
    // timestamp
    var date = new Date();

    // data for new record or to update
    var data = {
	    "Name" : req.body.name,
	    "Email" : req.body.email,
	    "Address 1" : req.body["address[]"][0],
	    "Address 2" : req.body["address[]"][1],
	    "City" : req.body["address[]"][2],
	    "State" : req.body["address[]"][3],
	    "Zip" : req.body["address[]"][4],
	    "Country" : req.body["address[]"][5],
	    "Telephone" : req.body.phonenumber,
	    "Session app" : req.body.session,
	    "Joint application" : req.body.jointperson,
	    "RSCDS member" : yesNoCheck(req.body.memberrscds),
	    "First timer" : yesNoCheck(req.body.firsttimer),
	    "Privacy" : multiSelect(req.body["privacyoptions[]"]),
	    "Roles" : multiSelect(req.body["camproles[]"]),
	    "Other roles" : req.body.otherrole,
	    "Kitchen work app" : yesNoCheck(req.body.applykwe),
	    "NGI app" : yesNoCheck(req.body.applyngi),
	    "SDCEA app" : yesNoCheck(req.body.applysdcea),
	    "ESC app" : yesNoCheck(req.body.applyesc),
	    "Family week app" : yesNoCheck(req.body.applyfamily)
    };
    syncAirTable(data, date);
    res.send(JSON.stringify(data, null, 4));
});

// POST method for PW survey
router.post('/survey', function (req, res) {
    // timestamp
    var date = new Date();

    // data for PW survey
    // data for new record or to update
    var data = {
	"Survey timestamp" : date.toUTCString(),
	"Name" : req.body.name,
	"Email" : req.body.email,
	"Badge name" : req.body.badgename,
	"Emergency name" : req.body.emergencyname,
	"Emergency phone" : req.body.emergencyphone,
	"Vegetarian" : yesNoCheck(req.body.vegetarian),
	"Other dietary" : req.body.otherdietary,
	"Housing environment" : req.body.housingenvironment,
	"Housing location" : req.body.housinglocation,
	"Cabin request" : req.body.housingrequest,
	"Housing needs" :req.body.housingneeds,
	"Request to share cabin" : yesNoCheck(req.body.willsharehousing),
	"Cabinmate request" : req.body.cabinmaterequest,
	"Camper age and gender" : req.body.camperagegender,
	"Cabinmate age and gender" : req.body.cabinmateagegender,
	"Job type preference" : req.body.jobtype,
	"Job meal preference" : multiSelect(req.body["jobmeal[]"]),
	"Job time preference" : req.body.jobtime,
	"Drink making" : multiSelect(req.body["drinkmaking[]"]),
	"Physical restrictions" : req.body["jobrestrictions[]"].toString(),
	"Job request" : req.body.jobrequest,
	"Arrive by 530" : yesNoCheck(req.body.arrivebefore530),
	"Arrive by dinner" : yesNoCheck(req.body.arrivebeforedinner),
	"Need ride" : yesNoCheck(req.body.needride),
	"Need ride from" : req.body.needridefrom,
	"Offer ride" : yesNoCheck(req.body.giveride),
	"Offer ride from" : req.body.giveridefrom,
	"Spots in car" : req.body.carspots,
	"Technique class" : req.body.techniqueclass,
	"Play music" : yesNoCheck(req.body.playmusic),
	"Instruments" : req.body.instruments,
	"Music experience" : req.body.musicexperience,
	"Attending ESC" : yesNoCheck(req.body.attendingesc),
	"Attending family week" : yesNoCheck(req.body.attendingfamily)
    };
    syncAirTable(data, date);
    // res.send(JSON.stringify(data, null, 4));

     res.send(JSON.stringify(req.body, null, 4));
});

module.exports = router;
