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
// 2018
// var base = new Airtable({ apiKey: 'keyRqRDLjkEOX4ipI' }).base('appzCfOTY0Ts1ljtS');
// 2019
// var base = new Airtable({ apiKey: 'keywRxtvV6KRgqyaa' }).base('appNgQMPn8pcgC4RA');
// 2020
// var base = new Airtable({ apiKey: 'keywRxtvV6KRgqyaa' }).base('appOWXi5GvpUYib9I');
// 2022
var base = new Airtable({ apiKey: 'keywRxtvV6KRgqyaa' }).base('appK0YDCvD6o6glgn');

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

// cuts string s off at first occurrence of character (or string c)
// does nothing if c does not occur
function cutAfter(s, c) {
    n = s.indexOf(c);
    if (n == -1) {
	return s;
    }
    else {
        return s.slice(0, n);
    }
}

// handles multiselect (checkboxes on the form)
// if we have selected only one option, JotForm gives us a string
// in this case, we need to convert it to an object (array of size 1)
function multiSelect(s) {
    if (typeof(s) == "string") {
	return([s]);
    } else {
	return s
    }
}

// handles multiselect, but cuts off strings with cutAfter
function multiSelectAfter(s, c) {
    if (typeof(s) !== "undefined") {
        if (typeof(s) == "string") {
            r = [s];
        } else {
            r = s;
        }
        for (i = 0; i < r.length; i++) {
               r[i] = cutAfter(r[i],c);
        } 
    return(r);
    }
}

// grabs the first word of string
// use for multiselects, where we only want first word for database
function firstWord(s) {
    return s.split(' ')[0];
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
    // timestamp
    var date = new Date();
    var deadline = new Date('2020-03-02 05:00 GMT');

    // process name
    name = req.body.name.trim();
    namearray = name.split(' ');
    namelen = namearray.length;
    lastname = namearray[namelen - 1];
    firstname = namearray.slice(0, namelen-1).join(' ');

    // data for new record or to update
    var data = {
	    "Name" : name,
            "First Name" : firstname,
	    "Last Name" : lastname,
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
            "Dance experience" : cutAfter(req.body.danceexperience,':'),
            "Dance years" : req.body.danceyears,
            "Dance class" : req.body.danceclass,
            "Dance other" : req.body.danceother,
	    "Kitchen work app" : yesNoCheck(req.body.applykwe),
	    "NGI app" : yesNoCheck(req.body.applyngi),
            "Age" : req.body.age,
	    "SDCEA app" : yesNoCheck(req.body.applysdcea),
	    "ESC app" : req.body.applyesc,
	    "Family week app" : req.body.applyfamily,
	    "Deposit payment method" : firstWord(req.body.paymentmethod)
    };

    // if before deadline, mark that
    if (date <= deadline) { 
        data["First Round"] = true;
    }

    // if electronic payment used, enter that info in database as well
    if (data["Deposit payment method"] == "Electronic") {
	data["Deposit received"] = true;
	data["Deposit email sent"] = true;
	data["Deposit amount"] = req.body["electronicpayment[]"][2];
    }
    syncAirTable(data, date);
    // res.send(JSON.stringify(req.body, null, 4));
    // res.send(JSON.stringify(data, null, 4));
    res.render('apply', { title: 'Thank you for applying to Pinewoods Scottish Sessions.' });
});

// POST method for PW payment
router.post('/payment', function (req, res) {
    // timestamp
    var date = new Date();
    var data = {
	"Name" : req.body.name,
	"Email" : req.body.email
    };
    if (req.body["paymentfield"] ) {
        var paymentField = req.body["paymentfield"]
    }
    else {
        var paymentField = "Payment 1"
    }
    paymentFee = paymentField + " fee";
    data[paymentField] = req.body["paymentamount"];
    if (req.body["electronicfee"]) data[paymentFee] = req.body["electronicfee"]
 
    syncAirTable(data, date);
    // res.send(JSON.stringify(req.body, null, 4));
    res.render('apply', { title: 'Thank you for submitting an electronic payment for Pinewoods Scottish Sessions.' });
});


// POST method for PW survey
router.post('/survey', function (req, res) {
    // timestamp
    var date = new Date();

    // data for PW survey
    // data for new record or to update
    var data = {
	"Survey timestamp" : date.toUTCString(),
        "Info form received" : true,
	"Name" : req.body.name,
	"Email" : req.body.email,
	"Badge name" : req.body.badgename,
        "Pronouns" : req.body.pronouns,
	"Emergency name" : req.body.emergencyname,
	"Emergency phone" : req.body.emergencyphone,
        "Paper copies" : multiSelect(req.body["papercopies[]"]),
	"Vegetarian" : yesNoCheck(req.body.vegetarian),
	"Other dietary" : req.body.otherdietary,
	"Housing environment" : req.body.housingenvironment,
	"Housing location" : multiSelectAfter(req.body["housinglocation[]"],'.'),
        "Housing type" : multiSelectAfter(req.body["housingspecifics[]"],' ('),
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
	"Job request" : req.body.jobrequest,
	"Arrive by 530" : yesNoCheck(req.body.arrivebefore530),
	"Arrive by dinner" : yesNoCheck(req.body.arrivebeforedinner),
        "Arrive after 630" : yesNoCheck(req.body.arriveafter630),
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
    if (req.body["jobrestrictions[]"]) {
        data["Physical restrictions"] = req.body["jobrestrictions[]"].toString()
    }

    syncAirTable(data, date);
    // res.send(JSON.stringify(data, null, 4));
    res.render('apply', { title: 'Thank you for submitting your Camper Information Form.' });
    // res.send(JSON.stringify(req.body, null, 4));
});

module.exports = router;
