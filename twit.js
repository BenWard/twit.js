/*
 * Twit.js
 *
 * A simple, needs-must JavaScript wrapper for the Twitter API.
 *
 * Requires: oauth.js, sha1.js
 *   <http://oauth.googlecode.com/svn/code/javascript/>
 *
 * Copyright 2010, Ben Ward
 *
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this 
 * list of conditions and the following disclaimer.
 * 
 * Redistributions in binary form must reproduce the above copyright notice, 
 * this list of conditions and the following disclaimer in the documentation 
 * and/or other materials provided with the distribution.
 * Neither the name of the <ORGANIZATION> nor the names of its contributors 
 * may be used to endorse or promote products derived from this software  
 * without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
 * 
 * If you reuse this code, you must maintain attribution to the original 
 * author(s) of this and any shared components.

 */
 
TwitJS = function(consumer_key, consumer_secret, options) {
        
    var opts = {};
    
    /** Define errors */
    this.E_HTTP_404             = 1;
    this.E_HTTP_500             = 2;
    this.E_HTTP_401             = 4;
    this.E_HTTP_UNKNOWN         = 8; // Some other, unexpected HTTP error
    this.E_INVALID_METHOD       = 16;
    this.E_ERRONEOUS_ERROR      = 32; // Internal error. Tried to set a non-int error code.
    this.E_AUTH_REQUIRED        = 64; // This method requires authorization.
    
    /** Meta */
    this.meta = {};
    this.meta.name = "Twit.js";
    this.meta.version = 0.1;
    
    /** Handle override options */
    if(!('object' === typeof(options) && (options instanceof Array))) {
        options = {};
    }
    
    // TODO: Parametize
    opts.consumer_key = 'Ysy1NDD28o4jzeU2cfz1Fw'; //consumer_key;
    opts.consumer_secret = 'R7qh8TnvgQXNVE1n9c6cIpV46ZrsJrd3upXgfNu6Y';// consumer_secret;
    
    
    opts.callback_url = options.callback_url || 'oob';
    opts.api_base = options.api_base ||  'api.twitter.com';
    opts.use_ssl = !!options.use_ssl || true;
    opts.api_verson = options.api_version || 1;
    opts.user_agent = options.user_agent || this.meta.name+"/"+this.meta.version;
    opts.debug = true === options.debug || false;

    /* Basic, core methods:
     * 1. Debugging
     * 2. Prerequesite checking
     * 3. HTTP
     * 4. API endpoint URL generation
     */

    /** Debugging. Off by default, enable with debug: true to the options object
     *    you can pass a custom logger function if you like, else defaults to
     *    console.log, falling back to alert if you're running something old.
     */
    var writelog;
    if(false === opts.debug) {
        writelog = function() { return; };
    }
    else if(options.logging_function && 'function' === typeof(options.logging_function)) {
        writelog = options.logging_function;
    }
    else if(console && console.log) {
        writelog = console.log;
    }
    else {
        writelog = alert;
    }
    
    /** Now that we have error reporting available, check prerequesites: */
    if(undefined === OAuth) {
        // Twit.js requires an OAuth library.
        // See http://oauth.googlecode.com/svn/code/javascript/
        writelog("OAuth object is missing. You must include oauth.js for Twit.js to function.");
        return false;
    }
    
    if(undefined === b64_hmac_sha1) {
        // The OAuth library requires SHA-1.
        // See http://pajhome.org.uk/crypt/md5
        writelog("b64_hmac_sha1 function is missing. OAuth requires this. You must include sha1.js for Twit.js to function.");
        return false;
    }
    
    /** Simple wrapper to make an XmlHttpRequest 
     * There's only one callback. In the event that the request fails,
     * last_error will be set and the error should be handled further down the
     * chain.
     * @param string url
     * @param string method HTTP method. GET, POST, PUT, DELETE, etc.
     * @param array headers Array of [name, value] nested arrays. Uses this format
     *   for consistancy with the OAuth lib, which encourages this for parameters.
     * @param string body The message body to send with the request
     * @param callback The callback function to be called when the request is
     *   completed.
     * @returns string|bool The response text of a request (or bool:true) when
     *   successful, or false if the request fails.
     * @see get_last_error()
     * @private
     */
    http_request = function(url, method, headers, body, callback) {
        
        var xhr = new XmlHttpRequest();
        xhr.onreadystatechange = function() {
            
            if(4 === xht.readyState) {
				if(200 === xht.status) {
					var rsp = xht.responseText;
                    
                    // return 'true' for empty responses
					if('' === rsp) {
					    rsp = true;
					}
					callback(rsp);
				}
				else if(404 === xht.status) {
				    set_error(this.E_HTTP_404);
				    callback(false);
				}
				else if(401 === xht.status) {
					set_error(this.E_HTTP_401);
					callback(false);
				}
				else if(500 <= xht.status) {
					set_error(this.E_HTTP_500);
                    callback(false);
				}
				else {
				    set_error(this.E_HTTP_UNKNOWN);
                    callback(false);
				}
			}  
        };
        // open the request
        xhr.open(method, url);
        xhr.setRequestHeader("User Agent", opts.user_agent);
        
        // set method headers
        if('object' === typeof(headers) && (headers instanceof Array)) {
            for(i=0; h = headers[i]; i++) {
                if(2 === h.length) {
                    xhr.setRequestHeader(h[0], h[1]);
                }
                else {
                    writelog("Invalid HTTP Request Header. Expected 2 parts, got " + h.length + ":");
                    writelog(h);
                }
            }
        }
        
        // send the payload
        if(null !== body && undefined !== body && '' !== body) {
            xhr.send(body);
        }
        else {
            xhr.send();
        }
    };
    
    /**
     * Make a signed OAuth request
     */
    oauth_request = function(url, method, params, headers, callback) {

        if(undefined === params) {
            params = [];
        }
        
        var message = {
            method: method,
            action: url,
            parameters: params
        };
        OAuth.completeRequest(message, oauth_accessor);
 
        http_request(
         message.action,
         message.method,
         [['Authorization', OAuth.getAuthorizationHeader("", message.parameters)],
          ['Content-Type', 'application/x-www-form-urlencoded']],
         OAuth.formEncode(message.parameters),
         callback
        );
    };
    
    
    /** Get the full URL for an API method
     * @param endpoint The method URL endpoint. e.g. "oauth/authenticate"
     * @returns string URL to the requested method name.
     * @private
     */
    get_api_method_url = function(endpoint) {
        var protocol = (opts.use_ssl) ? 'https' : 'http';
        var api_url = protocol + '://' + opts.api_base + '/';

        get_api_method_url = function(e) {
            return api_url + e;
        };
        
        return get_api_method_url(endpoint);
    };
    
    
    /**
     * Accessor object for the Twitter API, for use with the OAuth wrapper.
     */
    var oauth_accessor = {
        consumerKey: opts.consumer_key,
        consumerSecret: opts.consumer_secret,
        serviceProvider: {
            signatureMethod: "HMAC-SHA1",
            requestTokenURL: get_api_method_url('oauth/request_token'),
            userAuthorizationURL: get_api_method_url('oauth/authorize'),
            accessTokenURL: get_api_method_url('oauth/access_token'),
            echoURL: get_api_method_url('oauth/echo')
        }
    };
    
    // TODO: Remove debug logging
    writelog(oauth_accessor);
    
    /** The last error that occured. Faulty methods will return false.
      *  Error handlers should call this to find out what went wrong.
      *  Keep this bitwise compatible, to allow the horrendous occurance of
      *  multiple errors from the same operation. */
    var last_error = false;
    
    /**
     * Set the error code for the last error that occured in the system.
     *   Checks that you've set an integer, and sets the going-to-make-you-stab
     *   -yourself E_ERRONEOUS_ERROR as the error if it's not. Oh, how you'll
     *   laugh.
     * @private
     * @return void
     */
    set_error = function(err) {
        if(undefined === err || isNaN(parseInt(err))) {
            writelog("Tried to set an error code that was invalid: " + err);
            set_error(this.E_ERRONEOUS_ERROR);
        }
        else {
            last_error = err;
        }
    };

    /**
     * Immediately return an error if auth is required for a method
     * @return bool 
     */
    require_auth = function() {
        if(this.is_authed()) {
            return true;
        }
        else {
            set_error(this.E_AUTH_REQUIRED);
            return false;
        }
    };

    /**
     * @return int Numeric error code for the last error that occured
     * @public
     */
    this.get_last_error = function() {
        return last_error;
    };
    
    /* Authorization */
    
    /**
     * Is the user authenticated and keys exchanged such that we can act on
     *   their behalf?
     * @return bool
     * @public
     */
     this.is_authed = function() {
         return false;
     };
    
    /** 
     * Get a request token, before requesting user authorization
     * @param cb Callback function to call once the token has been returned.
     * @private 
     */
    auth_request_token = function(cb) {
        oauth_request(
            get_api_method_url('oauth/request_token'),
            'post',
            [],
            [],
            cb
        );
    };
    
    /**
     * Exchange an OAuth request token for an OAuth access token
     * @param cb Callback function to call once the token has been returned.
     * @private
     */
    auth_access_token = function(cb) {
        
    };
    
    /**
     * To access protected resources, the user must be authorized:
     * @return A URL to redirect the user to; requesting authorization for the app
     */
    this.auth_authorize_url = function(cb) {
        auth_request_token(function(rsp) {
            
            if(false === rsp) {
                return cb(false);
            }
            else {
                var rsp = OAuth.decodeForm(rsp);
                return cb(
                    get_api_method_url('oauth/authorize') 
                    + "?oauth_token="
                    + OAuth.getParameter(results, "oauth_token")
                );
            }
        })
    };
    
    /**
     * Authenticate using ‘Connect with Twitter’. Only available for web apps.
     * @return A URL to redirect the user to; requesting authentication for the app
     */
    this.auth_authenticate_url = function(cb) {
        if(undefined === opts.callback_url || 'oob' === opts.callback_url) {
            set_error(this.E_DESKTOP_CANNOT_AUTHENTICATE);
            return false;
        }
        
        // …
    };
    
    /**
     * Restore a previously authorized user using saved tokens
     */     
    this.auth_restore = function(oauth_token, oauth_token_secret, cb) {
        
    }
     
    /* User and Account */
    
    /* Timeline */
    
    /* Statuses */
    
    /* Direct Messages */
    
    /* Friends and Followers */
    
    /* Spam & Blocking */
    
    /* Lists */
    
    /* Trends */
    
    /* Search */
    
    /* Geo */
    
    
     
    
    return this;
};