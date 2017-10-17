'use strict';

Array.prototype.sortOn = function(sortProperty){
	var array = this;
	var sortFunction = ((sortProperty instanceof Function) ? sortProperty : function(item){
		return item[sortProperty];
	});
	return array.sort(function(itemA, itemB){
		var valA = (sortFunction(itemA) || 0);
		var valB = (sortFunction(itemB) || 0);
		if(valA > valB){
			return 1
		}else if(valA < valB){
			return -1
		}else{
			return 0;
		}
	});
}
Date.prototype.getMonthWithZeroes = function(){
	var date = this;
	return ('0' + (date.getMonth()+1)).slice(-2);
}
Date.prototype.getDateWithZeroes = function(){
	var date = this;
	return ('0' + date.getDate()).slice(-2);
}
Date.prototype.toArray = function(){
	var date = this;
	return [date.getFullYear(), date.getMonthWithZeroes(), date.getDateWithZeroes()];
}

var Controls = (function(){

	var DealProperties = {
		all: [],
		byName: {}
	}

	var Today = (new Date()).toArray();

	return {
		oninit: function(){
			m.request({
				method: 'GET',
				url: './deals/properties'
			}).then(function(properties){
				DealProperties.all = Object.values(properties).sortOn(function(item){
					return (item.name || item.label);
				});
				DealProperties.byName = properties;
			});
		},
		view: function(){
			return [
				m('label', [
					m('span', "You want to go back in time and see how Hubspot's Deals looked on which date?"),
					m('div.numbers', [
						m('input[type=number]', {
							min: 2012,
							max: 2022,
							placeholder: 'YYYY',
							value: Today[0]
						}),
						m('input[type=number]', {
							min: 1,
							max: 12,
							placeholder: 'MM',
							value: Today[1]
						}),
						m('input[type=number]', {
							min: 1,
							max: 31,
							placeholder: 'DD',
							value: Today[2]
						})
					])
				]),
				m('label', [
					m('span', "Which fields do you want to download? Pick multiple by holding 'Shift.'"),
					m('select', {
						multiple: true
					}, DealProperties.all.map(function(property){
						return m('option', {
							value: property.name
						}, property.label || property.name)
					}))
				]),
				m('button', 'Download to Excel-friendly Format')
			]
		}
	}

})();

window.addEventListener('DOMContentLoaded', function(){
	m.mount(document.getElementById('display'), Controls);
});
