'use strict';

Components.snapshot = function(){

    var Deals = [];
    var DealProperties = [];
    var DealPropertiesByName = {};
    var DefaultDealProperties = ['dealname', 'createdate', 'dealstage'];
    var RequestedDealProperties = [];

    var Query = {
        properties: (Location.query().properties ? Location.query().properties.split(',') : []),
        limitToFirst: (Location.query().limitToFirst || false),
        includeHistory: (Location.query().includeHistory || false)
    }

    var state = {
        propertiesLoadingStatus: 0,
        dealsLoadingStatus: 0,
        sortProperty: false,
        sortDirection: false
    }

    var addPropertyToQueryString = function(event){
        var propertyName = event.target.getAttribute('data-propertyName');
        Query.properties._addIfDoesNotInclude(propertyName);
        updateQueryString();
    }
    var removePropertyFromQueryString = function(event){
        var propertyName = event.target.getAttribute('data-propertyName');
        Query.properties._remove(event.target.getAttribute('data-propertyName'));
        updateQueryString();
    }
    var updateQueryString = function(){
        var qs = {};
        for(var propertyName in Query){
            if(Query[propertyName]){
                qs[propertyName] = Query[propertyName];
            }
        }
        qs.properties = Query.properties.join(',');
        Location.query(qs, true);
    }
    var sortOnColumn = function(event){
        state.sortProperty = event.target.getAttribute('data-sortProperty');
        state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');

        var fieldType = DealPropertiesByName[state.sortProperty].type;
        Deals._sortOn(function(deal){
            var value = deal[state.sortProperty];
            if(fieldType == 'number' || fieldType == 'currency'){
                return parseFloat(value || 0);
            }else if(value){
                return (value || '').toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
            }
        });
        if(state.sortDirection == 'asc'){
            Deals.reverse();
        }
    }
    var formatDealProperties = function(deal){
        RequestedDealProperties.forEach(formatDealProperty.bind(deal));
    }
    var formatDealProperty = function(propertyName){
        var deal = this;
        var value = deal[propertyName];
        switch(DealPropertiesByName[propertyName].type){
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

    var views = {
        input: function(stream){
            return {
                value: stream(),
                oninput: function(event){
                    event.redraw = false;
                    stream(event.target.value);
                    updateQuerystring();
                }
            }
        },
        checkbox: function(stream){
            return [
                m('input[type=checkbox]', {
                    checked: stream(),
                    onchange: function(event){
                        var currentStreamValue = stream();
                        stream(!currentStreamValue);
                        updateQuerystring();
                    }
                }),
                m('span')
            ]
        },
        properties: function(){
            return [
                m('p', "Select properties:"),
                m('div.select', [
                    m('table', [
                        DealProperties.map(function(property){
                            return m('tr', [
                                m('td', {
                                    'data-isHidden': (DefaultDealProperties.includes(property.name) || Query.properties.includes(property.name)),
                                    'data-propertyName': property.name,
                                    onclick: addPropertyToQueryString
                                }, property.label)
                            ])
                        })
                    ])
                ]),
                m('p', "De-select properties:"),
                m('div.select', [
                    m('table', [
                        DefaultDealProperties.concat(Query.properties).map(function(propertyName){
                            var isDefaultDealProperty = DefaultDealProperties.includes(propertyName);
                            return m('tr', [
                                m('td', {
                                    'data-disabled': isDefaultDealProperty,
                                    'data-propertyName': propertyName,
                                    onclick: (isDefaultDealProperty ? null : removePropertyFromQueryString)
                                }, DealPropertiesByName[propertyName].label)
                            ])
                        })
                    ])
                ])
            ]
        },
        sidebar: function(){
            return m('div.controls', [
                views.properties(),
                m('button', {
                    onclick: function(event){
                        var qs = JSON.parse(JSON.stringify(Location.query()));
                        qs.properties = DefaultDealProperties.concat(qs.properties).join(',');
                        state.dealsLoadingStatus = 1;
                        Deals = [];
                        m.request({
                            method: 'GET',
                            url: './deals/snapshot',
                            data: qs
                        }).then(function(response){
                            RequestedDealProperties = Object.keys(response.requestedProperties);
                            Deals = Object.values(response.deals);
                            Deals.forEach(formatDealProperties);
                            state.dealsLoadingStatus = 2;
                        });
                    }
                }, 'Load')
            ])
        },
        deals: function(){
            return [
                m('table.dealHeaders', [
                    m('thead', [
                        views.dealHeaders(true)
                    ])
                ]),
                m('table.dealRows', [
                    m('thead', [
                        views.dealHeaders()
                    ]),
                    m('tbody', [
                        Deals.map(views.dealRow)
                    ])
                ])
            ]
        },
        dealHeaders: function(isClickable){
            return m('tr', [
                m('th', {
                    title: 'dealId'
                }, 'Id'),
                RequestedDealProperties.map(function(propertyName){
                    var property = DealPropertiesByName[propertyName];
                    return m('th', {
                        title: property.name,
                        'data-propertyType': property.type,
                        'data-sortProperty': (isClickable ? property.name : false),
                        'data-sortDirection': (state.sortProperty == property.name ? state.sortDirection : false),
                        onclick: (isClickable ? sortOnColumn : false)
                    }, property.label)
                })
            ])
        },
        dealRow: function(deal){
            return m('tr', [
                m('td', deal.dealId),
                RequestedDealProperties.map(views.dealColumn.bind(deal))
            ])
        },
        dealColumn: function(propertyName){
            var deal = this;
            var property = DealPropertiesByName[propertyName];
            return m('td', {
                'data-propertyType': property.type,
            }, deal[property.name]);
        }
    }

    return {
        oninit: function(){
            state.propertiesLoadingStatus = 0;
            m.request({
                method: 'GET',
                url: './deals/properties'
            }).then(function(response){
                if(response.statusCode == 401){
                    location.href = "/authorize/reset";
                }else{
                    DealPropertiesByName = response;
                    DealProperties = Object.values(DealPropertiesByName)._sortOn(function(item){
                        return (item.label || item.name);
                    });
                    state.propertiesLoadingStatus = 2;
                }
            });
        },
        onupdate: function(){
            var hiddenDealHeaders = document.querySelectorAll('.dealRows thead th');
            var dealHeaders = document.querySelectorAll('.dealHeaders thead th');
            for(var i = 0; i < hiddenDealHeaders.length; i++){
                dealHeaders[i].style.width = hiddenDealHeaders[i].clientWidth + 'px';
            }
        },
        view: function(){
            return m('div.wrap', [
                m('div.sidebar', [
                    m('h1', 'Hubspot Snapshot'),
                    (
                        state.propertiesLoadingStatus == 2
                        ? views.sidebar()
                        : m('p', 'Loading...')
                    )
                ]),
                m('div.body', [
                    (
                        state.dealsLoadingStatus == 2
                        ? views.deals()
                        : m('div.dealLoadStatus',
                            state.dealsLoadingStatus == 1
                            ? m('p', 'Loading...')
                            : m('p', 'No deals loaded.')
                        )
                    )
                ])
            ])
        }
    }

}
