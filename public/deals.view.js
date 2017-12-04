'use strict';

var DealsView = function(){
	var views = {
		filterRow: function(){
			return m('tr', [
				m('td', {
					colspan: (Deals.propertiesRequested.length + 1)
				}, [
					m('input', {
						placeholder: 'Enter filter',
						hasError: !!(state.filterError),
						oninput: function(){
							state.filterError = false;
						},
						onkeyup: function(event){
							var isReturn = (event.keyCode == 13);
							if(isReturn){
								event.preventDefault();
								Deals.filter(event.target.value);
							}
						}
					})
				])
			])
		},
		headerTitlesRow: function(isClickable){
			return m('tr', [
				m('th', {
					title: 'dealId'
				}, '#'),
				Deals.propertiesRequested.map(function(propertyName){
					var property = Deals.propertiesByName[propertyName];
					return m('th', {
						title: property.name,
						'data-propertyType': property.type,
						'data-sortProperty': property.name,
						'data-enabled': !!(isClickable),
						'data-sortDirection': (state.sortProperty == property.name ? state.sortDirection : false),
						onclick: (isClickable ? Deals.sort.bind(property) : false)
					}, property.label)
				})
			])
		},
		headerCalculationsRow: function(){
			return m('tr.subheader', [
				m('td'),
				Deals.propertiesRequested.map(function(propertyName){
					var property = Deals.propertiesByName[propertyName];
					var value = Deals.calculations[property.name];
					if(value){
						if(property.type == 'currency'){
							value = value.toFixed(2);
						}
					}
					return m('td', {
						'data-propertyType': property.type
					}, value);
				})
			])
		},
		dataRow: function(deal, dealIndex){
			return m('tr', [
				m('td', [
					m('a', {
						title: 'dealId',
						href: 'https://app.hubspot.com/sales/' + HubspotPortalID + '/deal/' + deal.dealId
					}, Deals.allFiltered.length - dealIndex)
				]),
				Deals.propertiesRequested.map(views.dataColumn.bind(deal))
			])
		},
		dataColumn: function(propertyName){
			var deal = this;
			var property = Deals.propertiesByName[propertyName];
			return m('td', {
				'data-propertyType': property.type,
			}, deal[property.name]);
		}
	}

	return [
		m('table.dealHeaders', [
			m('thead.dealHeaderColumns', [
				views.headerTitlesRow(true),
				(Object.keys(Deals.calculations).length > 0 ? views.headerCalculationsRow() : null),
				views.filterRow()
			])
		]),
		m('table.dealRows', [
			m('thead.dealHeaderColumnsDummy', [
				views.headerTitlesRow()
			]),
			m('tbody', [
				Deals.allFiltered.map(views.dataRow)
			])
		])
	]
}
