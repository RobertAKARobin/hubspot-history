'use strict';

var Deals = (function(){

	var Deals = {
		all: [],
		allFiltered: [],
		properties: [],
		propertiesByName: {},
		propertiesDefault: ['dealname', 'createdate', 'dealstage'],
		propertiesRequested: [],
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
		try{
			var filterFunction  = new Function('deal', 'return ' + (filterString || 'true'));
			Deals.allFiltered = Deals.all.filter(filterFunction);
			Deals.calculations = {};
			Deals.propertiesRequested.forEach(function(propertyName){
				var property = Deals.propertiesByName[propertyName];
				if(property.type == 'number' || property.type == 'currency'){
					Deals.calculations[propertyName] = Deals.allFiltered.reduce(Deals.sumBy(property.name), 0);
				}
			});
		}catch(e){
			state.filterError = true;
			return false;
		}
	}
	Deals.formatProperties = function(deal){
		Deals.propertiesRequested.forEach(Deals.formatOneProperty.bind(deal));
	}
	Deals.formatOneProperty = function(propertyName){
		var deal = this;
		var value = deal[propertyName];
		switch(Deals.propertiesByName[propertyName].type){
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
		deal[propertyName] = value;
	}
	Deals.sort = function(){
		var property = this;
		state.sortProperty = property.name;
		state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');

		var fieldType = Deals.propertiesByName[state.sortProperty].type;
		Deals.allFiltered._sortOn(function(deal){
			var value = deal[state.sortProperty];
			if(fieldType == 'number' || fieldType == 'currency'){
				return parseFloat(value || 0);
			}else if(value){
				return (value || '').toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
			}
		});
		if(state.sortDirection == 'asc'){
			Deals.allFiltered.reverse();
		}
	}
	Deals.sumBy = function(propertyName){
		return function(sum, deal){
			return sum + parseFloat(deal[propertyName]);
		}
	}

	return Deals;
})();
