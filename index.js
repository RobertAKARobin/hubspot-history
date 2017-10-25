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
	.get('/deals/properties',
		HS.properties(),
		function(req, res, next){
			var defaultProperties = ['createdate', 'dealname', 'dealstage'];
			defaultProperties.forEach(function(propertyName){
				delete res.properties[propertyName];
			});
			res.json(res.properties);
		}
	)
	.get('/deals/snapshot', 
		HS.properties(),
		HS.stages(),
		HS.deals(),
		function(req, res, next){
			if(req.query.toJson){
				res.json({
					snapshotDate: req.snapshot.date._toArray().join('-'),
					deals: res.deals
				});
			}else{
				next();
			}
		},
		function(req, res, next){
			var cellDelimeter = '\t';
			var rowDelimeter = '\n';
			var filename = 'deals_snapshot_' + req.snapshot.date._toArray().join('-') + '.tsv';
			var propertyNames = req.snapshot.propertyNames, pIndex;
			var numProperties = propertyNames.length;
			var doIncludeTime = !!(req.query.includeTime);

			var tsv = res.deals.map(function(deal){
				var output = [], property;
				for(pIndex = 0; pIndex < numProperties; pIndex++){
					property = (deal[propertyNames[pIndex]] || {});
					output.push(property.value);
					if(doIncludeTime){
						output.push(property.time);
					}
				}
				output.unshift(deal.dealId);
				return output.join(cellDelimeter);
			});

			tsv.unshift(propertyNames._expand(function(output, propertyName){
				output.push(propertyName);
				if(doIncludeTime){
					output.push(propertyName + '_time');
				}
			}));
			tsv[0].unshift('dealId');
			tsv[0] = tsv[0].join(cellDelimeter);

			res.set('Content-Type', 'text/tab-separated-values');
			res.set('Content-Disposition', 'attachment; filename=' + filename);
			res.send(tsv.join(rowDelimeter));
		}
	);
