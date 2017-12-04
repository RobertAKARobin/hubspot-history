'use strict';

var DealsView = function(){
	var views = {
		filterRow: function(){
			return m('tr', [
				m('td', {
					colspan: Object.keys(Deals.propertiesRequested).length + 1
				}, [
					m('div.tableOptions', [
						m('label', {
							for: 'filter'
						}, 'Showing ' + Deals.allFiltered.length + ' of ' + Deals.all.length + '. Filter on:'),
						m('input', {
							id: 'filter',
							value: state.enteredFilter,
							placeholder: 'Enter filter',
							hasError: !!(state.filterError),
							onkeyup: function(event){
								var isReturn = (event.keyCode == 13);
								var filterString = event.target.value;
								state.filterError = false;
								state.enteredFilter = filterString;
								if(isReturn){
									event.preventDefault();
									try{
										Deals.filter(filterString);
										Query.filter = filterString;
										updateQueryString();
									}catch(e){
										state.filterError = true;
									}
								}
							}
						})
					])
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
					}, [
						m('span.title', property.label),
						(
							property.type == 'number' || property.type == 'currency'
							? m('span.sum',
								(
									property.type == 'currency'
									? '$' + Deals.calculations[property.name].toFixed(2)
									: Deals.calculations[property.name].toString()
								)
							)
							: null
						)
					])
				})
			])
		},
		dataRow: function(deal, dealIndex){
			return m('tr.dataRow', [
				m('td', [
					m('a.idlink', {
						title: 'dealId',
						href: 'https://app.hubspot.com/sales/' + HubspotPortalID + '/deal/' + deal.dealId
					}, dealIndex + 1)
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
