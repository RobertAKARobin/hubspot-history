'use strict';

Components.snapshot = function(){

    var DealProperties = [];

    var Query = {
        properties: (Location.query().properties || '').toString().split(','),
        limitToFirst: m.stream(Location.query().limitToFirst || false),
        includeHistory: m.stream(Location.query().includeHistory || false)
    }

    var state = {
        isLoaded: false
    }

    var updateQuerystring = function(){
        var qs = JSON.parse(JSON.stringify(Query));
        qs.properties = qs.properties.join(',');
        for(var propertyName in qs){
            if(qs[propertyName] == false){
                delete qs[propertyName];
            }
        }
        Location.query(qs, true);
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
                m('div', [
                    m('p', "Which Deal properties should be included in the snapshot?"),
                    m('p.instructions', "'Deal ID', 'Deal Name', 'Deal Stage', and 'Create Date' are always included."),
                    m('p.instructions', "Select multiple by holding 'Shift' or 'Command'/'Control' while you click.")
                ]),
                m('select', {
                    multiple: true,
                    onchange: function(event){
                        event.redraw = false;
                        var select = event.target;
                        var options = select.options;
                        var properties = [];
                        for(var i = 0; i < options.length; i++){
                            if(options[i].selected){
                                properties.push(options[i].value);
                            }
                        }
                        Query.properties = properties;
                        updateQuerystring();
                    }
                }, DealProperties.map(function(property){
                    return m('option', {
                        value: property.name,
                        selected: Query.properties.includes(property.name)
                    }, property.label || property.name)
                }))
            ])
        },
        submit: function(){
            return m('div.row', [
                m('p'),
                m('button', {
                    onclick: function(event){
                        event.redraw = false;
                        window.open('./deals/snapshot' + window.location.search);
                    }
                }, 'Load')
            ])
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
                    var defaultProperties = ['createdate', 'dealname', 'dealstage'];
                    defaultProperties.forEach(function(propertyName){
                        delete response[propertyName];
                    });
                    DealProperties = Object.values(response)._sortOn(function(item){
                        return (item.name || item.label);
                    });
                    state.isLoaded = true;
                }
            });
        },
        view: function(){
            if(state.isLoaded){
                return [
                    m('div.controls', [
                        m('h1', 'Hubspot Snapshot'),
                        views.properties(),
                        views.submit()
                    ]),
                    m('div')
                ]
            }else{
                return [
                    m('p', 'Loading Deal properties...')
                ]
            }
        }
    }

}
