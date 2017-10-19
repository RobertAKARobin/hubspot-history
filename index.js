'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var cookieParser = require('cookie-parser');
var path = require('path');

var HS = {
	authorize: require('./hs.auth'),
	api: require('./hs.api')
}
require('./public/helpers');

if(process.env['NODE_ENV'] != 'production'){
	require('dotenv').config();
	process.env.PORT = 3000;
	process.env['NODE_ENV'] = 'development';
	console.log('Dev environment');
}

var httpServer = express();
var baseServer = http.createServer(httpServer);
var DealProperties = undefined;
var DealStages = undefined;

baseServer
	.listen(process.env.PORT, function(){
		console.log(Date().toLocaleString())
	});

httpServer
	.use(cookieParser())
	.use(bodyParser.json())
	.use('/', express.static('./public'))
	.get('/authorize', HS.authorize.init())
	.get('/authorize/redirect', HS.authorize.redirect())
	.get('/authorize/reset', HS.authorize.reset())
	.get('*', HS.authorize.check())
	.get('/deals/properties',
		HS.api.properties(),
		function(req, res, next){
			res.json(res.properties);
		}
	)
	.get('/deals/snapshot\.:format?', 
		HS.api.properties(),
		HS.api.deals(),
		function(req, res, next){
			if(req.params.format == 'tsv'){
				next();
			}else{
				res.json(res.deals);
			}
		},
		function(req, res, next){
			var tsv = res.deals.map(function(deal){
				return deal.extractValuesByKeys(req.snapshot.propertyNames).join('\t');
			});
			var filename = 'deals_snapshot_' + req.snapshot.date.toArray().join('-') + '.tsv';

			tsv.unshift(req.snapshot.propertyNames.join('\t'));

			res.set('Content-Type', 'text/tab-separated-values');
			res.set('Content-Disposition', 'attachment; filename=' + filename);
			res.send(tsv.join('\n'));
		}
	);
