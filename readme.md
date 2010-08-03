# Twit.js

Twit.js is a simple 1:1 wrapper around the OAuth 1.0a Twitter API. More specifically, it's a higher-level abstraction of `oauth.js` and `XMLHttpRequest`, designed first to allow you interact with Twitter from browser-like environments (like the Mac OSX dashboard, or Fluidium, and so on.)

Requires: oauth.js, sha1.js and <http://oauth.googlecode.com/svn/code/javascript/>

It's the core wrapper that powers Twitgit.

## Repurposing

Although the shipping code is designed for a browser-like world, you should be able to repurpose this for other JavaScript environments by swapping the `TwitJS.prototype.httpRequest()` function for a compatible one that uses your framework/environment of choice. You'll need to set error codes and call a couple of other functions in the right places, but should be pretty workable.

## License

Twit.js is made available to you under the BSD License, which looks like this:

> Copyright 2010, Ben Ward <http://benward.me>
*
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
*
> Redistributions of source code must retain the above copyright notice, this
> list of conditions and the following disclaimer.
>
> Redistributions in binary form must reproduce the above copyright notice,
> this list of conditions and the following disclaimer in the documentation
> and/or other materials provided with the distribution.
> Neither the name of TwitJS nor the names of its contributors
> may be used to endorse or promote products derived from this software
> without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
> IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
> ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
> LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
> CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
> SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
> INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
> CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
> ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
> POSSIBILITY OF SUCH DAMAGE.
>
> If you reuse this code, you must maintain attribution to the original
> author(s) of this and any shared components.