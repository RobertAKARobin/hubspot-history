'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var cookieParser = require('cookie-parser');
var path = require('path');

if(process.env['NODE_ENV'] != 'production'){
	require('dotenv').config();
	process.env.PORT = 3000;
	process.env['NODE_ENV'] = 'development';
	console.log('Dev environment');
}

require('./public/helpers');

var HS = require('./hs.api');

var httpServer = express();
var baseServer = http.createServer(httpServer);

baseServer
	.listen(process.env.PORT, function(){
		console.log(Date().toLocaleString())
	});

httpServer
	.use(cookieParser())
	.use(bodyParser.json())
	.get('/authorize', HS.auth.init)
	.get('/authorize/redirect', HS.auth.redirect)
	.get('/authorize/reset', HS.auth.reset)
	.use('/', express.static('./public'))
	.get('*', HS.auth.check)
	.use('/', express.static('./views'))
	.get('/deals/stages',
		HS.stages(),
		function(req, res, next){
			res.json(res.stages);
		}
	)
	.get('/deals/properties',
		HS.properties(),
		function(req, res, next){
			res.json(res.properties);
		}
	)
	.get('/deals/snapshot',
		HS.properties(),
		HS.stages(),
		function(req, res, next){
			req.apiOptions = {
				propertiesWithHistory: !!(req.query.includeHistory),
				properties:  Array._fromCSV(req.query.properties)
					._addIfDoesNotInclude('dealname')
					._addIfDoesNotInclude('createdate')
					._addIfDoesNotInclude('dealstage')
			}
			req.limitToFirst = req.query.limitToFirst;
			next();
		},
		HS.deals(),
		function(req, res, next){
			res.json(res.deals);
		}
	);
