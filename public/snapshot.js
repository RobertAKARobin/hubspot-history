'use strict';

Components.snapshot = function(){

    var Deals = [];
    var RequestedProperties = [];
    var DealProperties = [];
    var DealPropertiesByName = {};
    var DefaultDealProperties = ['createdate', 'dealname', 'dealstage'];

    var Query = {
        properties: (Location.query().properties ? Location.query().properties.split(',') : []),
        limitToFirst: (Location.query().limitToFirst || false),
        includeHistory: (Location.query().includeHistory || false)
    }

    var state = {
        isLoaded: false,
        sortProperty: false,
        sortDirection: false
    }

    var addPropertyToQueryString = function(event){
        var propertyName = event.target.getAttribute('propertyName');
        if(!DefaultDealProperties.includes(propertyName)){
            Query.properties._addIfDoesNotInclude(propertyName);
            updateQueryString();
        }
    }
    var removePropertyFromQueryString = function(event){
        var propertyName = event.target.getAttribute('propertyName');
        if(!DefaultDealProperties.includes(propertyName)){
            Query.properties._remove(event.target.getAttribute('propertyName'));
            updateQueryString();
        }
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
        state.sortProperty = event.target.getAttribute('sortProperty');
        state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');

        var isNumber = (DealPropertiesByName[state.sortProperty].type == 'number');
        Deals._sortOn(function(deal){
            if(isNumber){
                return parseFloat(deal[state.sortProperty]);
            }else{
                return deal[state.sortProperty].toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
            }
        });
        if(state.sortDirection == 'asc'){
            Deals.reverse();
        }
    }
    var formatDealProperties = function(deal){
        RequestedProperties.forEach(formatDealProperty.bind(deal));
    }
    var formatDealProperty = function(property){
        var deal = this;
        var value = deal[property.name];
        switch(property.type){
            case 'datetime':
                value = (new Date(parseInt(value)))._toPrettyString();
                break;
            case 'number':
                value = (parseFloat(value) || 0);
                break;
        }
        deal[property.name] = value;
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
            return m('label', [
                m('p', "Select properties:"),
                m('div.select', [
                    m('table', [
                        DealProperties.map(function(property){
                            return m('tr', [
                                m('td', {
                                    isHidden: (Query.properties.includes(property.name)),
                                    propertyName: property.name,
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
                            return m('tr', [
                                m('td', {
                                    disabled: (DefaultDealProperties.includes(propertyName)),
                                    propertyName: propertyName,
                                    onclick: removePropertyFromQueryString
                                }, DealPropertiesByName[propertyName].label)
                            ])
                        })
                    ])
                ])
            ])
        },
        dealHeaders: function(){
            return m('tr', [
                m('th', 'Id'),
                RequestedProperties.map(function(property){
                    return m('th', {
                        propertyType: DealPropertiesByName[property.name].type,
                        sortProperty: property.name,
                        sortDirection: (state.sortProperty == property.name ? state.sortDirection : false),
                        onclick: sortOnColumn
                    }, property.label)
                })
            ])
        },
        dealRow: function(deal){
            return m('tr', [
                m('td', deal.dealId),
                RequestedProperties.map(views.dealColumn.bind(deal))
            ])
        },
        dealColumn: function(property){
            var deal = this;
            return m('td', {
                propertyType: DealPropertiesByName[property.name].type,
            }, deal[property.name]);
        }
    }

    return {
        oninit: function(){
            state.isLoaded = false;
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
                    state.isLoaded = true;
                }
            });
        },
        view: function(){
            if(state.isLoaded){
                return m('div.wrap', [
                    m('div.sidebar', [
                        m('div', [
                            m('h1', 'Hubspot Snapshot'),
                            views.properties(),
                            m('button', {
                                onclick: function(event){
                                    Deals = [];
                                    m.request({
                                        method: 'GET',
                                        url: './deals/snapshot',
                                        data: Location.query()
                                    }).then(function(response){
                                        RequestedProperties = Object.values(response.requestedProperties);
                                        Deals = Object.values(response.deals);
                                        Deals.forEach(formatDealProperties);
                                    });
                                }
                            }, 'Load')
                        ])
                    ]),
                    m('div.body', [
                        m('table', [
                            m('thead', [
                                views.dealHeaders()
                            ]),
                            m('tbody', [
                                Deals.map(views.dealRow)
                            ])
                        ])
                    ])
                ])
            }else{
                return [
                    m('p', 'Loading Deal properties...')
                ]
            }
        }
    }

}
