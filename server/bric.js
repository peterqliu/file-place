var bricLayout = function(images, type) {
  var count = images.length, box;

  if (count >= 2) {
    var images2 = [].concat(images);
    var images1 = images2.splice(0, Math.floor(count / 2));

    box = {
        type: 'box',
        box_type: type ? 'vertical' : 'horizontal',
        pixelCheck: false,
        leafs: {
            one: bricLayout(images1, !type),
            two: bricLayout(images2, !type)
        }
      };

    box.leafs.one.parentBoxType = box.leafs.two.parentBoxType = box.box_type;

    box.leafs.one.pixelCheck = false;
    box.leafs.two.pixelCheck = true;

    var dimensions;

    if (type) {
      dimensions = {
        width: box.leafs.one.totalWidth
      };
    }else {
      dimensions = {
        height: box.leafs.one.totalHeight
      };
    }

    box.leafs.two = bricLayoutScaleBox(box.leafs.two, dimensions);

    if (type) {
      // Horizontal contact; vertical box type.
      box.totalHeight = box.leafs.one.totalHeight + box.leafs.two.totalHeight;
      box.totalWidth = box.leafs.one.totalWidth;
    }else {
      // Vertical contact; horizontal box type.
      box.totalWidth = box.leafs.one.totalWidth + box.leafs.two.totalWidth;
      box.totalHeight = box.leafs.one.totalHeight;
    }

    box.leafs.one.parentTotalWidth = box.leafs.two.parentTotalWidth = box.totalWidth;
    box.leafs.one.parentTotalHeight = box.leafs.two.parentTotalHeight = box.totalHeight;
    box.leafs.one.siblingsTotalWidth = box.leafs.two.totalWidth;
    box.leafs.one.siblingsTotalHeight = box.leafs.two.totalHeight;
    box.leafs.two.siblingsTotalWidth = box.leafs.one.totalWidth;
    box.leafs.two.siblingsTotalHeight = box.leafs.one.totalHeight;

  }else if (count === 1) {
    box = images.pop();
  }

  return box;
};

var bricLayoutScaleBox = function(box, dimensions) {
  var dimensions1, dimensions2;

// If it is an image - just resize it (change dimensions).
  if (box.type == 'image') {
    if (dimensions.hasOwnProperty('width')) {
      box.totalHeight = (dimensions.width / box.totalWidth) * box.totalHeight;
      box.totalWidth = dimensions.width;
    }
    else if (dimensions.hasOwnProperty('height')) {
      box.totalWidth = (dimensions.height / box.totalHeight) * box.totalWidth;
      box.totalHeight = dimensions.height;
    }
    return box;
  }

  // If it is a box - then it should consist of two box elements;
  // Determine sizes of elements and resize them.
  if (dimensions.hasOwnProperty('width')) {
    // Vertical box type; horizontal contact.
    if (box.box_type === 'vertical') {
      dimensions1 = dimensions2 = dimensions;
    }
    // Horizontal box type; vertical contact.
    else if (box.box_type === 'horizontal') {
      dimensions1 = {'width' : (box.leafs.one.totalWidth / (box.leafs.one.totalWidth + box.leafs.two.totalWidth)) * dimensions.width};
      dimensions2 = {'width' : (box.leafs.two.totalWidth / (box.leafs.one.totalWidth + box.leafs.two.totalWidth)) * dimensions.width};
    }
  }
  else if (dimensions.hasOwnProperty('height')) {
    // Vertical box type; horizontal contact.
    if (box.box_type === 'vertical') {
      dimensions1 = {'height' : (box.leafs.one.totalHeight / (box.leafs.one.totalHeight + box.leafs.two.totalHeight)) * dimensions.height};
      dimensions2 = {'height' : (box.leafs.two.totalHeight / (box.leafs.one.totalHeight + box.leafs.two.totalHeight)) * dimensions.height};
    }
    // Horizontal box type; vertical contact.
    else if (box.box_type === 'horizontal') {
      dimensions1 = dimensions2 = dimensions;
    }
  }

  box.leafs.one = bricLayoutScaleBox(box.leafs.one, dimensions1);
  box.leafs.two = bricLayoutScaleBox(box.leafs.two, dimensions2);

  if (box.box_type === 'vertical') {
    box.totalHeight = box.leafs.one.totalHeight + box.leafs.two.totalHeight;
    box.totalWidth = box.leafs.one.totalWidth;
  }
  else if (box.box_type === 'horizontal') {
    box.totalWidth = box.leafs.one.totalWidth + box.leafs.two.totalWidth;
    box.totalHeight = box.leafs.one.totalHeight;
  }
  box.leafs.one.parentTotalWidth = box.leafs.two.parentTotalWidth = box.totalWidth;
  box.leafs.one.parentTotalHeight = box.leafs.two.parentTotalHeight = box.totalHeight;
  box.leafs.one.siblingsTotalWidth = box.leafs.two.totalWidth;
  box.leafs.one.siblingsTotalHeight = box.leafs.two.totalHeight;
  box.leafs.two.siblingsTotalWidth = box.leafs.one.totalWidth;
  box.leafs.two.siblingsTotalHeight = box.leafs.one.totalHeight;

  return box;
};

var bricLayoutCreateTree = function(box, options) {
  var output = {};

  if (box.hasOwnProperty('parentBoxType')) {
    if (box.parentBoxType === 'vertical') {
      box.totalWidth = box.parentTotalWidth;
    } else if (box.parentBoxType === 'horizontal') {
      box.totalHeight = box.parentTotalHeight;
    }
  }

  // if (box.pixelCheck) {
  //   if (box.parentBoxType == 'vertical') {
  //     box.totalHeight += Math.floor(box.parentTotalHeight) - Math.floor(box.totalHeight) - Math.floor(box.siblingsTotalHeight);
  //   }
  //   else if (box.parentBoxType == 'horizontal') {
  //     box.totalWidth += Math.floor(box.parentTotalWidth) - Math.floor(box.totalWidth) - Math.floor(box.siblingsTotalWidth);
  //   }
  // }

  if (box.type === 'box') {
    box.leafs.one.parentTotalHeight = box.leafs.two.parentTotalHeight = box.totalHeight;
    box.leafs.one.parentTotalWidth = box.leafs.two.parentTotalWidth = box.totalWidth;
  }

  if (box.type === 'image') {
    var image_width, image_height;

    image_width = Math.floor(box.totalWidth - 2 * options.border - options.spacing);
    image_height = Math.floor(box.totalHeight - 2 * options.border - options.spacing);


    var imageWrapper = {
      // style: 'float:left; outline:1px solid green; width:' + Math.floor(box.totalWidth - options.spacing) + 'px;height:' + Math.floor(box.totalHeight - options.spacing) + 'px;margin-top:' + options.spacing + 'px;margin-left:' + options.spacing + 'px;',
      w: Math.floor(box.totalWidth - options.spacing),
      h: Math.floor(box.totalHeight - options.spacing),
      image: {
        // style: 'border:' + options.border + 'px solid ' + box.border_color || '',
        width: Math.floor(box.totalWidth - options.spacing),
        height: Math.floor(box.totalHeight - options.spacing),
        image: box
      }
    };


    output = imageWrapper;

  }
  else if (box.type == 'box') {
    var newContainer = {
      // style: 'float:left;width: ' + Math.floor(box.totalWidth) + 'px;height:' + Math.floor(box.totalHeight) + 'px;',
      w: Math.floor(box.totalWidth),
      h: Math.floor(box.totalHeight),
      children: [bricLayoutCreateTree(box.leafs.one, options), bricLayoutCreateTree(box.leafs.two, options)]
    };

    output = newContainer;
  }

  return output;
};

/**

images = [{
    width:
    height:
    ... Custom info
}]

options = {
  width: int*,
  height: int*,
  spacing: int,
  border: int,
  layout: "horizontal" - default | "vertical"
}

* Mutual Exclusive

**/



var bricLayoutFitPics = function(images, options) {

  options.border = options.border || 0;
  options.spacing = options.spacing || 0;
  var layout;

  if(options.layout === "vertical"){
    layout = false;
  }else if(options.layout === "horizontal"){
    layout = true;
  }else{
    layout = false;
  }

  for (var i = 0; i < images.length; i++) {
    images[i].type = 'image';
    images[i].totalWidth = images[i].width + 2 * options.spacing + 2 * options.border;
    images[i].totalHeight = images[i].height + 2 * options.spacing + 2 * options.border;
  }

  var box = bricLayout(images, layout);
  resized = bricLayoutScaleBox(box, options);

  return bricLayoutCreateTree(resized, options);


};

function layout(images) {

  const start = performance.now();

  const output = [];
  const blfp = bricLayoutFitPics(
    images, 
    {
      width: 1000000,
      height: 1000000,
      layout: "vertical",
      spacing: 0
    }
  );

  const {w, h} = blfp;
  const scaleFactor = w>h ? 1 : w/h;
  open(blfp, [0,0]);

  function open(obj, xy) {

    const { children, image } = obj;
    const [x, y] = xy;

    if (children) {
        const {w, h} = children[0];
        const isVertical = obj.w === w;
  
        children.forEach((c,i) => {
          const coords = i ? (isVertical ? [x, y+h] : [x+w, y]) : xy;
          open(c, coords)
        })
    }
  
    else output.push({
      w: image.width * scaleFactor, 
      h: image.height * scaleFactor, 
      x: x * scaleFactor, 
      y: y * scaleFactor
    })
  }

  console.log('bric took', performance.now()-start, ' ms for ', images.length, ' images')
  return output;
}

module.exports = layout;