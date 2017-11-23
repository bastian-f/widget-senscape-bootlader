// Constants
// var URL_SERVLET = "//chilipeppr-servlet-c9-bastianf.c9users.io/SenschiliServlet/packet";
//var URL_SERVLET = "//127.0.0.1:8080/SenschiliServlet/packet";

//var URL_SERVLET = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/process-packet";
//var URL_PING = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/ping";
//var URL_POST_PING = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/post-ping";
//var URL_INJECT = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/inject";
// var URL_RETRANS = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/retransmission";
//var URL_REPROGRAM = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/reprogram";
//var URL_RESET = BASE_URL + "//52.29.6.200:8080/SenschiliServlet/reset";

var STATUS_IDLE = "Idle";
var STATUS_PINGING = "Status: Pinging...";
var STATUS_UPLOADING = "Status: Uploading...";
var STATUS_REPROG = "Status: Reprogramming - Please, do not disconnect the device!";
var STATUS_REPROG_C = "Status: Reprogramming C";
var STATUS_SUCCESS = "Success! - The device is reprogrammed. You can now disconnect your K-PROX.";
var STATUS_POST_PING = "postPing";
var STATUS_RESETTING = "resetting";

var DAT_BUF = "";

//var TIMEOUT = 20000;
//var waiting = false;


// For handling sending of http request sequentially
// TODO use something more sophisticated
// kue looks promising
// check out this: https://wiredcraft.com/blog/parallel-sequential-job-queue-redis-kue/
var queue = [];
var busy = false;

// We want to call a function 15 seconds after  we send a message to the node
// asking the server if it received ack or is retransmitting
var initial;
var postCountdown;

// Global to define the current status of reprogramming
var status = STATUS_IDLE;


function reset(){
    console.error("RESET!");
    status = "resetting";
    getServletRecString("//127.0.0.1:8080/SenschiliServlet/reset", 10000);

}

function invocation() {
    console.error("Invocation");
    initial = window.setTimeout(
        function() {
            if (!(status == STATUS_SUCCESS)) {
                console.error("Checking if there is a retransmission");
                postServletRecString(null, "//127.0.0.1:8080/SenschiliServlet/retransmission", 10000);
                invocation();
            }
            else {
                console.error("SUCCESS: No need to check for retransmission!");
            }
        }, 10000);
}

function postPing() {
    console.error("Inside Post Ping");
    postCountdown = window.setTimeout(
        function() {
            if (!(status == STATUS_SUCCESS)) {
                console.error("Checking if for post ping");
                console.error(status);
                getServletRecString("//127.0.0.1:8080/SenschiliServlet/post-ping", 10000);
                console.error("Status: " + status);
                console.error("No success, pinging AGAIN!");
                postPing();
            }
            else console.error("SUCCESS: finalizing post ping");
        }, 10000);
}

function setStatus(s) {
    var elem = document.getElementById("statustext");
    console.error("SETTING STATUS: " + s);
    if (!(s == STATUS_REPROG_C) && !(s == STATUS_POST_PING)) {
        console.error("NOT REPROG_C and NOT POST_PING");
        elem.innerHTML = s;
    }
    if (s == STATUS_PINGING) {
        $( "#statustext").removeClass("alert-success");
        $( "#statustext").addClass("alert-info");
    }
    else if (s == STATUS_REPROG) {
        $( "#statustext").removeClass("alert-info");
        $( "#statustext").addClass("alert-warning");
    }
    else if (s == STATUS_SUCCESS) {
        $( "#statustext").removeClass("alert-warning");
        $( "#statustext").addClass("alert-success");
    }
    status = s;
}

function ping() {
    console.error("Ping");
    status = "Status: Pinging...";
   // setStatus(STATUS_PINGING);
    invocation();
    $('#reprog').addClass('disabled');
    $( "#statustext").removeClass("alert-success");
    $( "#statustext").addClass("alert-info");
    var elem = document.getElementById("statustext");
    elem.innerHTML =  "Status: Pinging...";
    getServletRecString("//127.0.0.1:8080/SenschiliServlet/ping", 10000);
}

function reprogram() {
    console.error("reprogram");
  //  setStatus(STATUS_REPROG);
    $( "#statustext").removeClass("alert-info");
    $( "#statustext").addClass("alert-warning");
    var elem = document.getElementById("statustext");
    elem.innerHTML =  "Status: Reprogramming - Please, do not disconnect the device!";
    getServletRecString("//127.0.0.1:8080/SenschiliServlet/reprogram", 10000);
}

function inject() {
    console.error("Inject");
    var elem = document.getElementById("statustext");
    elem.innerHTML =  "Status: Uploading...";
   // setStatus(STATUS_UPLOADING);
 //   console.error("Inject");
    getServletRecString("//127.0.0.1:8080/SenschiliServlet/inject", 10000);
}

function postServletRecString(data, sUrl, timeout){
    console.error("URL: " + sUrl);
    var xhr = new XMLHttpRequest();
    xhr.ontimeout = function () {
        console.error("The request for " + sUrl + " timed out.");
    };
    xhr.onload = function (oEvent) {
        console.error("response text");
        console.error(xhr.responseText);
        var jsonResponse = JSON.parse(xhr.responseText);
        console.error("valid");
        console.error(jsonResponse.data.valid);
        if (jsonResponse.data.valid && !jsonResponse.data.hasOwnProperty('error')) {
            if (jsonResponse.data.hasOwnProperty('progress') &&  jsonResponse.data.hasOwnProperty('state') && jsonResponse.data.state ==='upload') {
                var elem = document.getElementById("progbar");
                elem.style.width = jsonResponse.data.progress + '%';
                elem.innerHTML = jsonResponse.data.progress + '%';
            }
            // If not success
            if (!(jsonResponse.data.hasOwnProperty('error') && jsonResponse.data.error === 0 && jsonResponse.data.hasOwnProperty('state') && jsonResponse.data.state ==='post-ping')) {
                chilipeppr.publish("/com-chilipeppr-widget-serialport/send", jsonResponse.data.payload);
                console.error("Clearing timeout!");
                window.clearTimeout(initial);
                initial = window.setTimeout(
                    function () {
                        console.error("Checking if there is a retransmission");
                        postServletRecString(null, "//127.0.0.1:8080/SenschiliServlet/retransmission", 10000);
                        invocation();
                    }, 10000);
            }
        }
        else if (!jsonResponse.data.valid && !jsonResponse.data.hasOwnProperty('error')) {
            console.error("Packet not valid.");
        }
        else if (jsonResponse.data.hasOwnProperty('error')){

            console.error("Got Result: Error:"  + jsonResponse.data.error);
            queue.length = 0;
            if (!jsonResponse.data.error) {
                console.error("STATE: " + jsonResponse.data.state);
                // We are doing the initial ping
                // and receiving an result with no error meaning
                // initial ping was successful and we can inject
                if (jsonResponse.data.state === 'ping') {
                    console.error("PING SUCCESSFUL! STARTING UPLOAD!");
                    var elem = document.getElementById("progbar");
                    elem.style.width = '1%';
                    elem.innerHTML = '1%';
                    inject();
                }
                // We are injecting
                // and receiving an result witn no error meaning
                // uploading was successful and we can reprogram
                else if (jsonResponse.data.state === 'upload') {
                    console.error("UPLOAD SUCCESSFUL! STARTING REPROGRAMMING!")
                    var elem = document.getElementById("progbar");
                    elem.style.width = '97%';
                    elem.innerHTML = '97%';
                    reprogram();
                }
                // We are reprogramming
                // and receiving a result with no error meaning
                // that the reprgramming was successfully started
                else if (jsonResponse.data.state === 'reprogram'){
                    console.error("REPROGRAMMING!")
                    setStatus(STATUS_REPROG_C);
                    console.error("clearing queue");
                    queue.length = 0;
                    var elem = document.getElementById("progbar");
                    elem.style.width = '98%';
                    elem.innerHTML = '98%';
                    console.error("Post Ping");
                    postPing();
                }
                // We are reprogramming with start confirmed
                // and receiving a result with no error meaning
                // the post ping executed successfully and reprogramming is finished
                else if (jsonResponse.data.state === 'post-ping') {
                    console.error("REPROGRAMMING SUCCESSFUL!!")
                    console.error("clearing queue");
                    queue.length = 0;
                    var elem = document.getElementById("progbar");
                    elem.style.width = '100%';
                    elem.innerHTML = '100%';
                    setStatus(STATUS_SUCCESS);
                //    $('#reprog').removeClass('disabled');
                }
            }
        }
        if(queue.length) {
            // run the next queued item
            console.error("Posting from queue.");
            postServletRecString(queue.shift(), "//127.0.0.1:8080/SenschiliServlet/process-packet", 10000);

        } else {
            console.error("No more petitions queued.")
            busy = false;
        }
    };
    xhr.responseType = "text";
    // Necessary to maintain session credentials using cross domain requests
    xhr.withCredentials = true;
    xhr.open("POST", sUrl, true);
    xhr.timeout = timeout;
    console.error("data to send: " + JSON.stringify(data));
    xhr.send(JSON.stringify(data));
    
}

function getServletRecString(sUrl, timeout){
    console.error("URL: " + sUrl);
    var xhr = new XMLHttpRequest();
    xhr.ontimeout = function () {
        console.error("The request for " + sUrl + " timed out.");
    };
    xhr.onload = function (oEvent) {
        console.error("response text");
        console.error(xhr.responseText);
        var jsonResponse = JSON.parse(xhr.responseText);
        if (!(status == STATUS_SUCCESS) && !(status == STATUS_RESETTING)) chilipeppr.publish("/com-chilipeppr-widget-serialport/send", jsonResponse.data);
        else if (status == STATUS_SUCCESS) console.error("GET: Not sending because success!");
        else if (status == STATUS_RESETTING) {
            console.error("Not sending because resetting");
            queue.length = 0;
        }
    };
    xhr.responseType = "text";
    // Necessary to maintain session credentials using cross domain requests
    xhr.withCredentials = true;
    xhr.open("GET", sUrl, true);
    xhr.timeout = timeout;
    xhr.send();

}


requirejs.config({
    /*
    Dependencies can be defined here. ChiliPeppr uses require.js so
    please refer to http://requirejs.org/docs/api.html for info.
    
    Most widgets will not need to define Javascript dependencies.
    
    Make sure all URLs are https and http accessible. Try to use URLs
    that start with // rather than http:// or https:// so they simply
    use whatever method the main page uses.
    
    Also, please make sure you are not loading dependencies from different
    URLs that other widgets may already load like jquery, bootstrap,
    three.js, etc.
    
    You may slingshot content through ChiliPeppr's proxy URL if you desire
    to enable SSL for non-SSL URL's. ChiliPeppr's SSL URL is
    https://i2dcui.appspot.com which is the SSL equivalent for
    http://chilipeppr.com
    */
    paths: {
        // Example of how to define the key (you make up the key) and the URL
        // Make sure you DO NOT put the .js at the end of the URL
        // SmoothieCharts: '//smoothiecharts.org/smoothie',
    },
    shim: {
        // See require.js docs for how to define dependencies that
        // should be loaded before your script/widget.
    }
});

cprequire_test(["inline:com-senscape-widget-bootloader"], function(myWidget) {

    // Test this element. This code is auto-removed by the chilipeppr.load()
    // when using this widget in production. So use the cpquire_test to do things
    // you only want to have happen during testing, like loading other widgets or
    // doing unit tests. Don't remove end_test at the end or auto-remove will fail.

    // Please note that if you are working on multiple widgets at the same time
    // you may need to use the ?forcerefresh=true technique in the URL of
    // your test widget to force the underlying chilipeppr.load() statements
    // to referesh the cache. For example, if you are working on an Add-On
    // widget to the Eagle BRD widget, but also working on the Eagle BRD widget
    // at the same time you will have to make ample use of this technique to
    // get changes to load correctly. If you keep wondering why you're not seeing
    // your changes, try ?forcerefresh=true as a get parameter in your URL.

    console.log("test running of " + myWidget.id);

    $('body').prepend('<div id="testDivForFlashMessageWidget"></div>');

    chilipeppr.load(
        "#testDivForFlashMessageWidget",
        "http://fiddle.jshell.net/chilipeppr/90698kax/show/light/",
        function() {
            console.log("mycallback got called after loading flash msg module");
            cprequire(["inline:com-chilipeppr-elem-flashmsg"], function(fm) {
                //console.log("inside require of " + fm.id);
                fm.init();
            });
        }
    );

    // init my widget
    myWidget.init();
    $('#' + myWidget.id).css('margin', '20px');
    $('title').html(myWidget.name);

} /*end_test*/ );

// This is the main definition of your widget. Give it a unique name.
cpdefine("inline:com-senscape-widget-bootloader", ["chilipeppr_ready", /* other dependencies here */ ], function() {
    return {
        /**
         * The ID of the widget. You must define this and make it unique.
         */
        id: "com-senscape-widget-bootloader", // Make the id the same as the cpdefine id
        name: "Widget / Senscape Bootloader", // The descriptive name of your widget.
        desc: "Widget to upload programs to Senscape Boards.", // A description of what your widget does
        url: "(auto fill by runme.js)",       // The final URL of the working widget as a single HTML file with CSS and Javascript inlined. You can let runme.js auto fill this if you are using Cloud9.
        fiddleurl: "(auto fill by runme.js)", // The edit URL. This can be auto-filled by runme.js in Cloud9 if you'd like, or just define it on your own to help people know where they can edit/fork your widget
        githuburl: "(auto fill by runme.js)", // The backing github repo
        testurl: "(auto fill by runme.js)",   // The standalone working widget so can view it working by itself
        /**
         * Define pubsub signals below. These are basically ChiliPeppr's event system.
         * ChiliPeppr uses amplify.js's pubsub system so please refer to docs at
         * http://amplifyjs.com/api/pubsub/
         */
        /**
         * Define the publish signals that this widget/element owns or defines so that
         * other widgets know how to subscribe to them and what they do.
         */
        publish: {
            // Define a key:value pair here as strings to document what signals you publish.
           // '/onExampleGenerate': 'Example: Publish this signal when we go to generate gcode.'
        },
        /**
         * Define the subscribe signals that this widget/element owns or defines so that
         * other widgets know how to subscribe to them and what they do.
         */
        subscribe: {
            // Define a key:value pair here as strings to document what signals you subscribe to
            // so other widgets can publish to this widget to have it do something.
            // '/onExampleConsume': 'Example: This widget subscribe to this signal so other widgets can send to us and we'll do something with it.'
        },
        /**
         * Document the foreign publish signals, i.e. signals owned by other widgets
         * or elements, that this widget/element publishes to.
         */
        foreignPublish: {
            // Define a key:value pair here as strings to document what signals you publish to
            // that are owned by foreign/other widgets.
            // '/jsonSend': 'Example: We send Gcode to the serial port widget to do stuff with the CNC controller.'
        },
        /**
         * Document the foreign subscribe signals, i.e. signals owned by other widgets
         * or elements, that this widget/element subscribes to.
         */
        foreignSubscribe: {
            // Define a key:value pair here as strings to document what signals you subscribe to
            // that are owned by foreign/other widgets.
            // '/com-chilipeppr-elem-dragdrop/ondropped': 'Example: We subscribe to this signal at a higher priority to intercept the signal. We do not let it propagate by returning false.'
                  //       '/com-chilipeppr-widget-serialport/recvline': "(High-level mode) When in high-level mode, i.e. setSinglePortMode(), this is the signal we receive incoming serial data on. This signal sends us data in a per-line format so we do not have to piece the data together like we do in low-level mode.",

        },
        /**
         * All widgets should have an init method. It should be run by the
         * instantiating code like a workspace or a different widget.
         */
        init: function() {
            console.log("I am being initted. Thanks.");

            this.setupUiFromLocalStorage();
            this.btnSetup();
         //   this.forkSetup();
           // this.loadDropTestWidget();
            chilipeppr.subscribe("/com-chilipeppr-widget-serialport/recvline", this, this.onRecvLine);
            reset();
         //   invocation();
            console.log("I am done being initted.");
        },
        /**
         * Call this method from init to setup all the buttons when this widget
         * is first loaded. This basically attaches click events to your 
         * buttons. It also turns on all the bootstrap popovers by scanning
         * the entire DOM of the widget.
         */
        btnSetup: function() {

            // Chevron hide/show body
            var that = this;
            $('#' + this.id + ' .hidebody').click(function(evt) {
                console.log("hide/unhide body");
                if ($('#' + that.id + ' .panel-body').hasClass('hidden')) {
                    // it's hidden, unhide
                    that.showBody(evt);
                }
                else {
                    // hide
                    that.hideBody(evt);
                }
            });

            // Ask bootstrap to scan all the buttons in the widget to turn
            // on popover menus
            $('#' + this.id + ' .btn').popover({
                delay: 1000,
                animation: true,
                placement: "auto",
                trigger: "hover",
                container: 'body'
            });

            $('#' + this.id + ' .btn-reprogram').click(this.onReprogramBtnClick.bind(this));


        },
        isAlreadySubscribedToWsRecv: false,
        consoleSubscribeToLowLevelSerial: function() {
            // subscribe to websocket events
            if (this.isAlreadySubscribedToWsRecv) {
                console.warn("already subscribed to /ws/recv in console, so not subscribing again");
            } else {
                this.isAlreadySubscribedToWsRecv = true;
                chilipeppr.subscribe("/com-chilipeppr-widget-serialport/ws/recv", this, function(msg) {
            
                    // make sure the data is for the port we're bound to
            //        if (msg.match(/^\{/)) {
                        // it's json
                        //console.log("it is json");
                        var data = $.parseJSON(msg);
                        if (this.portBoundTo && this.portBoundTo.Name && data.P && data.P == this.portBoundTo.Name) {
                            // this is our serial port data
                            var d = data.D;
                        }
            //        }
                });
            }
        },
        /**
         * onMessageTestBtnClick sends a binary test message to the Senscape Board
         */
        onReprogramBtnClick: function (evt) {
           // reprogram();
           ping();

        },
        /**
         * onPingBtnClick sends a test message to the servlet
         */
        onPingBtnClick: function(evt) {
            console.error("Ping");
            setStatus("ping");
            getServletRecString("//127.0.0.1:8080/SenschiliServlet/ping", 10000);

        },
        /**
         * Process data received from node
         *
         */
        onRecvLine: function(data) {
            console.error("received!");
          //  waiting = false;
            var arrayBuffer = data.dataline;
            arrayBuffer = arrayBuffer.substring(0, arrayBuffer.length - 1);
            console.error("data: " + arrayBuffer);
            if (!(status == STATUS_SUCCESS)) {
                console.error("no success.")
                // Add new data to buffered data
                DAT_BUF = DAT_BUF.concat(arrayBuffer);
                // Check if buffer is of even length
                if (DAT_BUF.length % 2 == 0) {
                    console.error("even length: " + DAT_BUF.length);
                    var chunks = [];
                    for (var i = 0;  i < DAT_BUF.length; i += 2) {
                        console.error("i: " + i);
                        chunks.push(DAT_BUF.substring(i, i + 2));
                    }
                    console.error("finished loop");
                    console.error(chunks[0]);
                    console.error(chunks[0].localCompare('c0'));
                    // check if buffer starts with control byte
                    if (chunks[0].localCompare('c0') === 0) {
                        console.error("got first control byte");
                        // Look for next control Byte
                        var i = 0
                        var found = false;
                        while(!found && i < chunks.length){
                            i = i + 1;
                            if (chunks[i].localCompare('c0') == 0) found = true;
                        }
                        if (found) {
                            console.error("found");
                            // Got complete package and no more
                            var data = "";
                            if (i == chunks.length) {
                                console.error("got complete package and no nore data");
                                data = DAT_BUF;
                                DAT_BUF = "";
                            }
                            else {
                                console.error("got complete package and more data");
                                data = DAT_BUF.substring(0, i * 2 + 2);
                                DAT_BUF = DAT_BUF.substring(i * 2 + 2, DAT_BUF.length);
                            }

                            if (busy) {
                                console.error("Busy, queueing...");
                                queue.push(data);
                            }
                            else {
                                console.error("Not busy, processing data: " + arrayBuffer + ", url: " + "//127.0.0.1:8080/SenschiliServlet/process-packet" + ", timeout: " + 10000);
                                busy = true;
                                postServletRecString(data, "//127.0.0.1:8080/SenschiliServlet/process-packet", 10000);
                            }
                        }
                        else console.error("Not a complete package yet.");
                    }
                    else {
                        console.error("something went wrong, data does not start with control byte");
                        DAT_BUF = "";
                    }
                }
                else console.error("Uneven length, not a complete package");
            }
        },
        /**
         * User options are available in this property for reference by your
         * methods. If any change is made on these options, please call
         * saveOptionsLocalStorage()
         */
        options: null,
        /**
         * Call this method on init to setup the UI by reading the user's
         * stored settings from localStorage and then adjust the UI to reflect
         * what the user wants.
         */
        setupUiFromLocalStorage: function() {

            // Read vals from localStorage. Make sure to use a unique
            // key specific to this widget so as not to overwrite other
            // widgets' options. By using this.id as the prefix of the
            // key we're safe that this will be unique.

            // Feel free to add your own keys inside the options 
            // object for your own items

            var options = localStorage.getItem(this.id + '-options');

            if (options) {
                options = $.parseJSON(options);
                console.log("just evaled options: ", options);
            }
            else {
                options = {
                    showBody: true,
                    tabShowing: 1,
                    customParam1: null,
                    customParam2: 1.0
                };
            }

            this.options = options;
            console.log("options:", options);

            // show/hide body
            if (options.showBody) {
                this.showBody();
            }
            else {
                this.hideBody();
            }

        },
        /**
         * When a user changes a value that is stored as an option setting, you
         * should call this method immediately so that on next load the value
         * is correctly set.
         */
        saveOptionsLocalStorage: function() {
            // You can add your own values to this.options to store them
            // along with some of the normal stuff like showBody
            var options = this.options;

            var optionsStr = JSON.stringify(options);
            console.log("saving options:", options, "json.stringify:", optionsStr);
            // store settings to localStorage
            localStorage.setItem(this.id + '-options', optionsStr);
        },
        /**
         * Show the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we 
         * know it was clicked by the user and thus we store it for the next 
         * load so we can reset the user's preference. If you don't pass this 
         * value in we don't store the preference because it was likely code 
         * that sent in the param.
         */
        showBody: function(evt) {
            $('#' + this.id + ' .panel-body').removeClass('hidden');
            $('#' + this.id + ' .panel-footer').removeClass('hidden');
            $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-up');
            $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = true;
                this.saveOptionsLocalStorage();
            }
            // this will send an artificial event letting other widgets know to resize
            // themselves since this widget is now taking up more room since it's showing
            $(window).trigger("resize");
        },
        /**
         * Hide the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we 
         * know it was clicked by the user and thus we store it for the next 
         * load so we can reset the user's preference. If you don't pass this 
         * value in we don't store the preference because it was likely code 
         * that sent in the param.
         */
        hideBody: function(evt) {
            $('#' + this.id + ' .panel-body').addClass('hidden');
            $('#' + this.id + ' .panel-footer').addClass('hidden');
            $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-up');
            $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = false;
                this.saveOptionsLocalStorage();
            }
            // this will send an artificial event letting other widgets know to resize
            // themselves since this widget is now taking up less room since it's hiding
            $(window).trigger("resize");
        },


    };
});