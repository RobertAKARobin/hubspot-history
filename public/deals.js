'use strict';

var Deals = (function(){

	var Deal = {};
	Deal.formatOneProperty = function(property){
		var deal = this;
		var value = deal[property.name];
		switch(property.type){
			case 'datetime':
				value = (new Date(parseInt(value)))._toPrettyString();
				break;
			case 'currency':
				value = (parseFloat(value) || 0).toFixed(2);
				break;
			case 'number':
				value = (parseFloat(value) || 0);
				break;
		}
		deal[property.name] = value;
	}

	var Deals = {
		all: [],
		allFiltered: [],
		properties: [],
		propertiesByName: {},
		propertiesRequested: {},
		defaultPropertyNames: ['dealname', 'createdate', 'dealstage'],
		calculations: {},
	};
	
	Deals.filter = function(filterString){
		var quotes = [];
		filterString = (filterString || '');
		filterString = filterString
			.replace(/(".*?[^\\]"|'.*?[^\\]')/g, function(match){
				quotes.push(match);
				return '%%%%';
			})
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
		console.log(filterString)

		var filterFunction  = new Function('deal', 'return ' + (filterString || 'true'));
		Deals.allFiltered = Deals.all.filter(filterFunction);
		Deals.calculations = {};
		Object.values(Deals.propertiesRequested).forEach(function(property){
			if(property.type == 'number' || property.type == 'currency'){
				Deals.calculations[propertyName] = Deals.allFiltered.reduce(Deals.sumBy(property), 0);
			}
		});
	}
	Deals.formatProperties = function(deal){
		Object.values(Deals.propertiesRequested).forEach(Deal.formatOneProperty.bind(deal));
	}
	Deals.sort = function(property){
		var fieldType = Deals.propertiesByName[property.name].type;
		Deals.allFiltered._sortOn(function(deal){
			var value = deal[property.name];
			if(fieldType == 'number' || fieldType == 'currency'){
				return parseFloat(value || 0);
			}else if(value){
				return (value || '').toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
			}
		});
	}
	Deals.sumBy = function(property){
		return function(sum, deal){
			return sum + parseFloat(deal[property.name]);
		}
	}

	return Deals;
})();
