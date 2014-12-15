'use strict';

var _ = require('underscore');
var HTTP = require('q-io/http');

var config = require('./config.js');
var beam = require('./example.json');
var math = require('mathjs');

var lights;

var isDynamic = function (state){
    for(var property in state) {
        if (property === 'bri'){
            if (typeof state[property] === 'string') {
                return true;
            } 
         } 
    }
    return false;
};

var calculateProperty = function(state, property, t){
    if (typeof state[property] === 'string') {
        var scope = {
          t: t,
        }; 
        return math.eval(state[property], scope);
    } else {
        return state[property]; 
    }
};

var calculateState = function(state, t){
    console.log('t:', t);
    var calculatedState = {};
    var calculatables = ['bri'];
    _.each(Object.keys(state), function(key){
        // property saturation
        // property color
        if (_.contains(calculatables, key)){
            calculatedState[key] = Math.round(calculateProperty(state, key, t));
        } else {
            calculatedState[key] = state[key];   
        }
    });

    return JSON.stringify(calculatedState);
};

var buildRequest = function(command, bulb, t, transistiontime){
    var state = calculateState(command.state,t );
    state[transistiontime] = transistiontime;
    var body = [state];
    
    console.log('building ' , body , ' to light ' , bulb);
            
    return {
        'host': config.host,
        'path': '/api/' + config.username + '/lights/' + bulb + '/state',
        'method': 'PUT',
        'body': body
    };
};

var runCommand = function(command, bulbs, t, transistiontime) {
    
    _.each(bulbs, function(bulb){
        HTTP.request(buildRequest(command, bulb, t, transistiontime));
    });
};

var nextCommand = function(ray, current, currentStarted){
    var command = ray.commands[current];
    if (isDynamic(command.state)) {
        console.log('dynamic state');        
        return function(){
            
            if (command.for !== null && command.for !== 0){
                if (new Date().getTime() >= (currentStarted.getTime() + command.for)){
                    console.log('moving on');
                    current = current +1;   
                    currentStarted = new Date();
                }
            }
            console.log('then dynamic tick');        
            nextTick(ray, current, currentStarted);
        };
    } else {
        return function(){
            console.log('command:', command);
            setTimeout(function(){
                console.log('then static tick, current:', current);  
                current = current +1; 
                currentStarted = new Date();
                nextTick(ray, current, currentStarted);
            }, command.for); //todo: it should be (started + for -now)
        };
    }
};

var nextTick = function (ray, current, currentStarted) {
    console.log('next tick');
    
    current = current % ray.commands.length;

    // max 10 commands per second
    // http://www.developers.meethue.com/documentation/core-concepts
    var timeout = 100 * lights.length;
    var transistiontime = timeout / 100;
    var t = new Date() - currentStarted;

    runCommand(ray.commands[current], lights, t, transistiontime);

    var next = nextCommand(ray, current, currentStarted);

    setTimeout(function(){
        next();
    }, timeout);
};

var selectBulbs = function(){
        //  "all",
        //     "groups" : ["living"],
        //     "requires" : ["color"],
        return [1,2];
};

exports.run = function(ray, bridge) {
    console.log('Running beam ', ray, ' on ', bridge);
    console.log('With config ', config);
    lights = selectBulbs(ray.lights, {});
    nextTick(ray, 0, new Date());
};

exports.beam = beam;
exports.config = config;
exports.run(beam, config.host);