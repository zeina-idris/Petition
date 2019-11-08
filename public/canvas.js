var context = document.getElementById('canvasId').getContext("2d");
var clickX = [];
var clickY = [];
var canvas = $('#canvasId');
var clickDrag = [];
var paint;

canvas.mousedown(function(e){
    var mouseX = e.offsetX;
    var mouseY = e.offsetY;

    paint = true;
    addClick(e.offsetX, e.offsetY);
    redraw();
});

canvas.mousemove(function(e){
    if(paint) {
        addClick(e.offsetX, e.offsetY, true);
        redraw();
    }
});

canvas.mouseleave(function(e){
    paint = false;
})

canvas.mouseup(function(e){
    paint = false;
    $('input[name=signature]').val($('#canvasId')[0].toDataURL());
})


  function addClick(x, y, dragging)
  {
    clickX.push(x);
    clickY.push(y);
    clickDrag.push(dragging);
    }


function redraw(){
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  context.strokeStyle = 'black';
  context.lineJoin = "round";
  context.lineWidth = 2.0;

  for(var i=0; i < clickX.length; i++) {
    context.beginPath();
    if(clickDrag[i] && i){
      context.moveTo(clickX[i-1], clickY[i-1]);
      }else{
        context.moveTo(clickX[i]-1, clickY[i]);
      }
      context.lineTo(clickX[i], clickY[i]);
      context.closePath();
      context.stroke();
  }
}
