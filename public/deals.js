'use strict';

var Deals = (function(){

	var Deals = {
		all: [],
		allFiltered: [],
		properties: [],
		propertiesByName: {},
		propertiesRequested: {},
		defaultPropertyNames: ['dealname', 'dealstage'],
		calculations: {}
	};
	
	Deals.filter = function(filterString){
		var quotes = [];
		filterString = (filterString || '').replace(/(".*?[^\\]"|'.*?[^\\]')/g, function(match){
			quotes.push(match);
			return '%%%%';
		});

		var requestedPropertyNames = Object.keys(Deals.propertiesRequested);
		var propertyMatcher = /\$([^\s]*)/g;
		var filterProperty = propertyMatcher.exec(filterString);
		while(filterProperty){
			if(!requestedPropertyNames.includes(filterProperty[1])){
				throw({
					name: 'NoPropertyError',
					property: filterProperty[1]
				});
			}
			filterProperty = propertyMatcher.exec(filterString);
		}

		filterString = filterString
			.replace(/\$/g, 'deal.')
			.replace(/alert\(.*?\)|confirm\(.*?\)|prompt\(.*?\)/g, '')
			.replace(/\bAND\b/gi, '&&')
			.replace(/\bOR\b/gi, '||')
			.replace(/\bNOT\s+/gi, '!')
			.replace(/\s+HAS\s+(%%%%)/gi, '.indexOf(%%%%) > -1')
			.replace(/([^<>])(=+)/g, function(nil, modifier, equalses){
				return modifier + (equalses.length == 1 ? '==' : equalses);
			})
			.replace(/≠/g, '!=')
			.replace(/≥/g, '>=')
			.replace(/≤/g, '<=')
			.replace(/%%%%/g, function(){
				return quotes.shift();
			});
		console.log('Filter string:\n' + filterString)


		var filterFunction  = new Function('deal', 'return ' + (filterString || 'true'));
		Deals.allFiltered = Deals.all.filter(filterFunction);
		Deals.calculations = {};
		Object.values(Deals.propertiesRequested).forEach(function(property){
			if(property.type == 'number' || property.type == 'currency'){
				var values = Deals.allFiltered.map(function(deal){
					return deal[property.name];
				});
				Deals.calculations[property.name] = {
					sum: Math._sum(values),
					avg: Math._mean(values),
					med: Math._median(values),
					mode: Math._mode(values)
				}
			}
		});
	}
	Deals.formatProperty = function(property){
		var propertyName = property.name;
		if(property.type == 'datetime' || property.type == 'date'){
			Deals.all.forEach(function(deal){
				var value = parseInt(deal[propertyName]);
				deal[propertyName] = (value ? (new Date(value))._toPrettyString() : '');
			});
		}else if(property.type == 'number' || property.type == 'currency'){
			Deals.all.forEach(function(deal){
				var value = parseFloat(deal[propertyName]);
				deal[propertyName] = (value || 0);
			});
		}else{
			Deals.all.forEach(function(deal){
				var value = deal[propertyName];
				deal[propertyName] = (value || '');
			});
		}
	}
	Deals.sort = function(property){
		var fieldType = property.type;
		Deals.allFiltered._sortOn(function(deal){
			var value = deal[property.name];
			if(fieldType == 'number' || fieldType == 'currency'){
				return parseFloat(value || 0);
			}else if(value){
				return (value || '').toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
			}
		});
	}

	return Deals;
})();
