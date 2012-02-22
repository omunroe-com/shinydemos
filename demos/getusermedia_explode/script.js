/*
 * Original code by Sean Christmann: 
 * http://www.craftymind.com/2010/04/20/blowing-up-html5-video-and-mapping-it-into-3d-space/
 * 
 * Edited for use with camera and touch screen by Daniel Davis (Opera Software)
 */

// Global constants & variables
var exploding = {
    TILE_WIDTH : 32,
    TILE_HEIGHT : 24,
    TILE_CENTER_WIDTH :  this.TILE_WIDTH / 2,
    TILE_CENTER_HEIGHT : this.TILE_HEIGHT / 2,
    SOURCERECT : {
        width : 0,
        height : 0
    },
    PAINTWIDTH : window.innerWidth,
    PAINTHEIGHT : window.innerHeight,
    RAD : Math.PI / 180,
    tiles : []    
};

exploding.init = function() {
    video = document.querySelector('video');
    exploding.canvas1 = document.getElementById('canvas1');
    exploding.context1 = exploding.canvas1.getContext('2d');
    
    var canvas2 = document.getElementById('canvas2');
    exploding.context2 = canvas2.getContext('2d');
    canvas2.width = window.innerWidth;
    canvas2.height = window.innerHeight;
    var mouse_down = ('createTouch' in document) ? 'ontouchstart' : 'onmousedown';
    canvas2[mouse_down] = function() {
        exploding.dropBomb(event, this);
    };
    
    // Get the stream from the camera using getUserMedia
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    if (navigator.getUserMedia) {        
        if (window.webkitURL) {
            navigator.getUserMedia('video', function(stream) {
                // Replace the source of the video element with the stream from the camera
                video.src = window.webkitURL.createObjectURL(stream);
            }, errorCallback);
        } else {
            navigator.getUserMedia({video: true}, function(stream) {
                // Replace the source of the video element with the stream from the camera
                video.src = stream;
            }, errorCallback);
        }

        function errorCallback(error) {
            console.error('An error occurred: [CODE ' + error.code + ']');
            return;
        }
    } else {
        var errorMsg = '<p class="error">Uh oh, it appears your browser doesn\'t support this feature.<br>Please try with a <a href="http://my.opera.com/core/blog/2011/03/23/webcam-orientation-preview">browser that has camera support</a>.';
        document.querySelector('[role=main]').innerHTML = errorMsg;
        console.log('Native web camera streaming (getUserMedia) is not supported in this browser.');
        return;
    }
    
    // Start drawing to the canvas once the video is ready.
    video.addEventListener('canplay', function() {
        if (!isNaN(video.duration)) {
            exploding.canvas1.width = video.videoWidth;
            exploding.canvas1.height = video.videoHeight;
            
            if (exploding.SOURCERECT.width == 0) {
                exploding.SOURCERECT = {
                    width : video.videoWidth,
                    height : video.videoHeight
                };
                
            }
            
            exploding.createTiles();
            
            // Start drawing the stream to the canvas
            setInterval(function() {             
                exploding.processFrame(video)
            }, 33);
        }
    }, false);
};

exploding.createTiles = function() {
    exploding.TILE_WIDTH = exploding.canvas1.width / 16;
    exploding.TILE_HEIGHT = exploding.canvas1.height / 16;
    exploding.TILE_CENTER_WIDTH = exploding.TILE_WIDTH / 2 >> 0;
    exploding.TILE_CENTER_HEIGHT = exploding.TILE_HEIGHT / 2 >> 0;
                
    var offsetX = (exploding.TILE_CENTER_WIDTH + (exploding.PAINTWIDTH - exploding.SOURCERECT.width) / 2 >> 0);
    var offsetY = (exploding.TILE_CENTER_HEIGHT + (exploding.PAINTHEIGHT - exploding.SOURCERECT.height) / 2 >> 0);
    var y = 0;
    while (y < exploding.SOURCERECT.height) {
        var x = 0;
        while (x < exploding.SOURCERECT.width) {
            var tile = new exploding.Tile();
            tile.videoX = x;
            tile.videoY = y;
            tile.originX = offsetX + x;
            tile.originY = offsetY + y;
            tile.currentX = tile.originX;
            tile.currentY = tile.originY;
            exploding.tiles.push(tile);
            x += exploding.TILE_WIDTH;
        }
        y += exploding.TILE_HEIGHT;
    }
};

exploding.processFrame = function(video) {
    //copy tiles
    exploding.context1.drawImage(video, 0, 0);
    exploding.context2.clearRect(0, 0, exploding.PAINTWIDTH, exploding.PAINTHEIGHT);
    
    for (var i = 0, len = exploding.tiles.length; i < len; i++) {
        var tile = exploding.tiles[i];
        if (tile.force > 0.0001) {
            //expand
            var force = tile.force;
            tile.moveX *= force;
            tile.moveY *= force;
            tile.moveRotation *= force;
            tile.currentX += tile.moveX;
            tile.currentY += tile.moveY;
            tile.rotation += tile.moveRotation;
            tile.rotation %= 360;
            tile.force *= 0.9;
            if (tile.currentX <= 0 || tile.currentX >= exploding.PAINTWIDTH) {
                tile.moveX *= -1;
            }
            if (tile.currentY <= 0 || tile.currentY >= exploding.PAINTHEIGHT) {
                tile.moveY *= -1;
            }
        } else if (tile.rotation != 0 || tile.currentX != tile.originX || tile.currentY != tile.originY) {
            //contract
            var diffx = (tile.originX - tile.currentX) * 0.2;
            var diffy = (tile.originY - tile.currentY) * 0.2;
            var diffRot = (0-tile.rotation)*0.2;
            
            if (exploding.absolute(diffx) < 0.5) {
                tile.currentX = tile.originX;
            } else {
                tile.currentX += diffx;
            }
            if (exploding.absolute(diffy) < 0.5) {
                tile.currentY = tile.originY;
            } else {
                tile.currentY += diffy;
            }
            if (exploding.absolute(diffRot) < 0.5) {
                tile.rotation = 0;
            } else {
                tile.rotation += diffRot;
            }
        } else {
            tile.force = 0;
        }
        exploding.context2.save();
        exploding.context2.translate(tile.currentX, tile.currentY);
        exploding.context2.rotate(tile.rotation * exploding.RAD);
        exploding.context2.drawImage(exploding.canvas1, tile.videoX, tile.videoY, exploding.TILE_WIDTH, exploding.TILE_HEIGHT, exploding.TILE_CENTER_WIDTH * -1, exploding.TILE_CENTER_HEIGHT * -1, exploding.TILE_WIDTH, exploding.TILE_HEIGHT);
        exploding.context2.restore();
    }
};

exploding.explode = function(x, y) {
    for(var i = 0, len = exploding.tiles.length; i < len; i++) {
        var tile = exploding.tiles[i];
        
        var xdiff = tile.currentX - x;
        var ydiff = tile.currentY - y;
        var dist = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        var rnd = Math.random();
        
        var randRange = 180 + (rnd * 10);
        var range = randRange - dist;
        var force = 3 * (range/randRange);
        if (force > tile.force) {
            tile.force = force;
            var radians = Math.atan2(ydiff, xdiff);
            tile.moveX = Math.cos(radians);
            tile.moveY = Math.sin(radians);
            tile.moveRotation = 0.5 - rnd;
        }
    }
    exploding.tiles.sort(exploding.zindexSort);
}

exploding.zindexSort = function(a, b) {
    return (a.force - b.force);
}

exploding.dropBomb = function(evt, obj) {
    evt.preventDefault();
    var posx = 0;
    var posy = 0;
    var e = evt || window.event;
    
    if (evt.touches) {
        posx = event.touches[0].pageX;
        posy = event.touches[0].pageY;
    }else if (e.pageX || e.pageY) {
        posx = e.pageX;
        posy = e.pageY;
    }else if (e.clientX || e.clientY) {
        posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    var canvasX = posx-obj.offsetLeft;
    var canvasY = posy-obj.offsetTop;
    exploding.explode(canvasX, canvasY);
}

// Constructor for individual tiles
exploding.Tile = function() {
    this.originX = 0;
    this.originY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.rotation = 0;
    this.force = 0;
    this.z = 0;
    this.moveX= 0;
    this.moveY= 0;
    this.moveRotation = 0;
    this.videoX = 0;
    this.videoY = 0;
}

// Slightly faster than Math.abs
exploding.absolute = function(x) {
    return (x < 0 ? -x : x);
}

window.addEventListener('DOMContentLoaded', exploding.init, false);

