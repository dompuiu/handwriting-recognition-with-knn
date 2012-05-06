<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
	<meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />
	<title></title>
</head>
<body>
	<canvas id="canvas" style="border: 1px solid grey;" width="320" height="240"></canvas>
    <br/>
    <button>Import</button>
    <script src="http://cdnjs.cloudflare.com/ajax/libs/labjs/2.0.3/LAB.min.js"></script>
    <script>
        getBits = function (pixels) {
            var i, l, result = [];
            for (i = 0, l = pixels.length; i < l; i +=4) {
                if (pixels[i + 3] !== 0) {
                    result.push(i/4);
                }
            }

            return result;
        }
        
       $LAB
       .script("https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js").wait(function () {
           $('button').click(function () {
                var load, glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], im = 0, jm = 0, fail = false;
                
                load = function () {
                    $.ajax({
                      url: "largeTrainingDigits/" + im + '_' + jm + '.txt',
                    }).done(function ( data ) {
                        var canvas = $('canvas').get(0);
                        var ctx = canvas.getContext('2d');
                        var bits = ctx.getImageData(0, 0, 320, 240);
                        
                        fail = false;
                        data = data.replace(/\n/g, '');
                        for (var i = 0, l = data.length; i < l; i += 1) {
                            var pos = (i * 4) + 3;
                            if (data[i] === "1") {
                                bits.data[pos] = 255;
                            }
                        }

                        ctx.putImageData(bits, 0, 0);
                        var json = JSON.stringify({
                            type: String(im),
                            bits: getBits(bits.data),
                            data: canvas.toDataURL("image/png"),
                        });
                        $.ajax({
                            url: "02-db.php",
                            type: 'POST',
                            data: {data: json, type: im},
                        }).done(function () {
                            jm++;
                            setTimeout(function () {
                                canvas.width = canvas.width;
                                load();
                            }, 10);
                        });
                        
                        
                        
                    }).fail(function() {
                        if (fail) {
                            alert('done');
                            return false;
                        }
                        
                        fail = true;
                        im++;
                        jm = 0;
                        
                        load();
                    });
                }                
                
                load();
            });
       });
    </script>
</body>
</html>