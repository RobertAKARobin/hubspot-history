'use strict';

var DealsView = function(){
	var views = {
		filterRow: function(){
			return m('tr', [
				m('td', {
					colspan: Object.keys(Deals.propertiesRequested).length + 1
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
								try{
									Deals.filter(event.target.value);
								}catch(e){
									state.filterError = true;
								}
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
				Object.values(Deals.propertiesRequested).map(function(property){
					return m('th', {
						title: property.name,
						'data-propertyType': property.type,
						'data-sortProperty': property.name,
						'data-enabled': !!(isClickable),
						'data-sortDirection': (state.sortProperty == property.name ? state.sortDirection : false),
						onclick: (isClickable ? function(event){
							state.sortProperty = property.name;
							state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');
							Deals.sort(property);
							if(state.sortDirection == 'asc'){
								Deals.allFiltered.reverse();
							}
						 } : false)
					}, property.label)
				})
			])
		},
		headerCalculationsRow: function(){
			return m('tr.subheader', [
				m('td'),
				Object.values(Deals.propertiesRequested).map(function(property){
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
				Object.values(Deals.propertiesRequested).map(views.dataColumn.bind(deal))
			])
		},
		dataColumn: function(property){
			var deal = this;
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
