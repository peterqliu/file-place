
var map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8, 
        sources: {}, 
        layers: [], 
        glyphs: "font/noto/{range}.pbf?{fontstack}"
        // glyphs: "font/{fontstack}-{range}.pbf"
    },
    renderWorldCopies:false,
    transition: { duration:0 },
    // hash: true,
    // maxBounds: [[-180, -90], [180, 90]],
    doubleClickZoom: false
});

const utils = {
    
    s: new sm({size:1}),
    
    NDCToLngLat: (c) => utils.s.ll(c, 0),
    NDCToPx: (distance, zoom) => distance * 512 * Math.pow(2, zoom),

    // given a min px value and NDC value, return zoom at which px value will be reached
    NDCToZoomAtMinPxSize: (distance, px) => Math.log2(px/(distance * 512)),

    // NDC point to geojson point
    drawPoint: (pt, properties) => ({
        "type": "Feature",
        "properties": properties || {},
        "geometry": {
            "coordinates": utils.NDCToLngLat(pt),
            "type": "Point"
        }
    }),

    // NDC point to geojson polygon
    drawBox: (w,h,ul, properties) => {

        const [west, north] = utils.NDCToLngLat(ul);
        const [east, south] = utils.NDCToLngLat([ul[0]+w, ul[1]+h]);
        
        return  {
            "type": "Feature",
            "properties": properties || {},
            "geometry": {
              "coordinates": [
                [
                    [west, north],
                    [east, north],
                    [east, south],
                    [west, south],
                    [west, north]
                ]
              ],
              "type": "Polygon"
            }
        }

    },

    getBbox: (w,h,ul) => {
        const [west, north] = utils.NDCToLngLat(ul);
        const [east, south] = utils.NDCToLngLat([ul[0]+w, ul[1]+h]);

        return [[west, south], [east, north]]
    },

    addSprite: (url, name, w, options, cb) => {
        map.loadImage(url, (err, img) => {

            if (err) return
            const {height, width} = img;

            map.addImage(
                name, 
                img, 
                {...options, pixelRatio: 1 }
            );
            
            // {pixelRatio:Math.max(height,width)/512}
            if (cb) cb();
        })
    },

    addPixelSprite: ([r,g,b,a], name, [x,y] = [1,1]) => {
        
        const data = new Uint8Array(4*x*y);
        
        data[0] = r;
        data[1] = g;
        data[2] = b;
        data[3] = a;
        map.addImage( name, { width: x, height: y, data: data });

    }


}


map.on('load', () => {

    utils.addSprite('img/file-solid.png', 'file', 0.05,{sdf: true});
    utils.addPixelSprite([0,0,0,0], 'blank');
    utils.addSprite('img/white.png', 'white');

    map.addSource('pt', {
        type:'geojson',
        data: state.geojson.labels,
        promoteId: 'i'
    })

    map.addSource('fills', {
        type:'geojson',
        data: state.geojson.fills,
        promoteId: 'i'
    })
    map

    .addLayer({
        id:'folders',
        source: 'fills',
        filter: ['==', 'ext', false],
        type:'fill', 
        paint: {
            'fill-opacity': 0,
            // 'fill-translate': [-4, -11]
        }
    })
    .addLayer({
        id:'file-hit-test',
        source: 'fills',
        filter: notAFolder,
        type:'fill', 
        paint: {

            'fill-opacity': 0.5,
            'fill-color': fileColorRule
            // 'line-offset': 5
            // 'fill-translate': [-4, -11]
        }
    })

    
    .addLayer({
        id:'file-icon-text',
        
        filter: notAFolder,
        type:'symbol', 
        layout: {
            'icon-image': 'file',
            'icon-size': 0.08,

            'text-field':'{ext}',
            // 'text-justify': 'left',
            'text-anchor': 'center',
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-size': ['/',40, ['length', ['get', 'ext']]],
            // 'text-rotate': 30
        },
        paint: {
            'icon-color': fileColorRule,
            'text-color': 'white',
            'text-opacity': [
                '/', 
                ['^', 1.2, ['length', ['get', 'ext']]], 
                6
            ]
        },
        source: 'pt'
    })

    .addLayer({
        id:'label',
        // filter: notAFolder,
        type:'symbol', 
        layout: {
            'text-field':'{n}',
            'text-size': 12,
            // 'text-justify': 'left',
            'text-anchor': 'top',
            'icon-allow-overlap': true,
            'text-allow-overlap': true
        },
        paint: {
            'text-color': 'white',
            'text-translate': [0, 25],
            'text-opacity':0.999 // force depth test with thumbnails (to keep this label behind thumb)
            // 'icon-translate': [0, 40]            
        },
        source: 'pt'
    })


    for (var t=0; t<23; t++) {
        map
        .addLayer({
            id: `thumbs${t}`,
            type: 'symbol',
            source: 'pt',
            filter: ['all', notAFolder, ['>', 'w', Math.pow(0.5, t+3)]],
            minzoom: t,
            maxzoom: t+2,
            layout: {
                'icon-image': [
                    'coalesce',
                    ['image', ['concat', 's',['get', 'i']]],
                    'blank'
                ],
    
                'icon-size': [
                    'interpolate',
                    ['exponential', 2],
                    ['zoom'],
                    t, ['*', Math.pow(2,t+1), ['get', 'w']],
                    t+2,['*', Math.pow(2,t+3), ['get', 'w']]
                ],
                'icon-allow-overlap': true,
                'text-allow-overlap': true,
            }
        })
    }

    map
        .addLayer({
            id:'item-buffer',
            source: 'fills',
            filter: notAFolder,
            type:'line', 
            paint: {
                'line-width':
                // [
                //     "interpolate", ["exponential", 2], ["zoom"],
                //     0,                         ['*', 32, ['^',['get', 'cW'], 0.5]], 
                //     ,
                //     // zoom is 10 (or greater) -> circle radius will be 5px
                //     22, ['*', 16 * Math.pow(2,8), ['^',['get', 'w'], 0.5]], 

                // ],
                
                {
                    property: 'cW',
                    base:2,
                    stops: [
                        [{zoom:0, value: 0}, 0],
                        [{zoom:0, value: 1}, 16],
                        [{zoom:22, value: 0}, 0],
                        [{zoom:22, value: 1}, 16 * constants.p22],
                    ]
                },
                'line-color': '#333',
                // 'line-opacity': 0
            }
        })
        .addLayer({
            id:'file-icon-dot',
            source: 'pt',
            filter: notAFolder,
            type:'circle', 
            layout: {
    
            },
            paint: {
                'circle-opacity':0,
                'circle-color': fileColorRule,
                'circle-radius':  {
                    property: 'w',
                    base:2,
                    stops: [
                        [{zoom:0, value: 0}, 0],
                        [{zoom:0, value: 1}, 160],
                        [{zoom:22, value: 0}, 0],
                        [{zoom:22, value: 1}, 160 * constants.p22],
                    ]
                }
            },
        })
        .addLayer({
            id: 'folder-outline',
            filter: ['==', 'ext', false],
            source: 'fills',
            type: 'line',

            paint: {
                'line-color': 'white',
                'line-dasharray': [1,1],
                'line-opacity': [
                    ...featureState('hovered'),
                    1,
                    0.25
                ],
                'line-width': 2,
                'line-offset':3
            },

            layout: {
                'line-join': 'round'
            }
        })
        .addLayer({
            id:'folder-label',
            filter: ['==', 'ext', false],
            type:'symbol', 
            layout: {
                ...textStyle,
                'text-font':['Italic'],
                'text-max-width':8,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [4,4,4,4],
                'text-field':'{n}',
                'text-size': 16,
                // 'text-justify': 'left',
                'text-anchor': 'bottom',
            },
            paint: {
                'text-color': [
                    ...featureState('hovered'),
                    'orange',
                    'white'
                ],
                'text-halo-width': 2,
                'text-halo-blur':2,
                'text-halo-color': '#333'
            },
            source: 'pt'
        })
        .addLayer({
            id:'folder-details',
            filter: ['==', 'ext', false],
            type:'symbol', 
            layout: {
                ...textStyle,
                // 'text-font':['Italic'],
                'text-max-width': 8,
                'text-field':  [
                    'concat', 
                    ['get', 'q'], ' item', 
                    [
                        'case', 
                        ['>', ['get', 'q'], 1], 
                        's', ''
                    ],
                ], 
                
                'text-size': 12,
                // 'text-justify': 'left',
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#ccc',
                'text-halo-width': 2,
                'text-halo-blur':2,
                'text-halo-color': '#333'
            },
            source: 'pt'
        })
        .addLayer({
            id:'folder-corner-labels',
            source: {
                type:'geojson',
                data: state.geojson.cornerFolderLabels
            },
            filter: ['==', 'ext', false],
            type:'symbol', 
            layout: {
                ...textStyle,
                'text-font': [
                    'case', 
                    isFolderBool, 
                    ['literal', ['Italic']], 
                    ['literal', ['Open Sans Regular,Arial Unicode MS Regular']]
                ],
                'text-anchor': 'top-left',
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [0,14,8,0],
                'icon-anchor': 'top-left',
                'icon-image': 'white',
                'icon-offset': [
                    'case', 
                    isFolderBool, 
                    ['literal', [0,0]], 
                    ['literal', [10,10]]
                ],

                'text-field': [
                    'case', 
                    isFolderBool, 
                    ['get', 'n'], 
                    ['concat', ['get', 'n'], ['string', '.'], ['get', 'ext']]
                ],
                // '{n}',
                'text-size': 
                [
                    'case', 
                    isFolderBool, 
                    16, 
                    12
                ], 
                // [
                //     "interpolate", ["exponential",1.25], ["zoom"],
                //     0, [
                //         'case', 
                //         ['boolean', ['==', ['get', 'ext'], false]], 
                //         ['*', 32, ['^',['get', 'w'], 0.5]], 
                //         ['*', 24, ['^',['get', 'w'], 0.5]], 
                //     ],
                //     // zoom is 10 (or greater) -> circle radius will be 5px
                //     22, [
                //         'case', 
                //         ['boolean', ['==', ['get', 'ext'], false]], 
                //         ['*', 16 * Math.pow(2,8), ['^',['get', 'w'], 0.5]], 
                //         ['*', 12 * Math.pow(2,8), ['^',['get', 'w'], 0.5]], 
                //     ]
                // ],
                'text-justify': 'left',
                'icon-allow-overlap': true,
            },
            paint: {
                'text-color': [
                    ...featureState('hovered'),
                    'orange',
                    '#333'
                ],
                'icon-opacity': 0.5,
                // 'text-halo-width': 2,
                // 'text-halo-color': '#333',
                'text-translate': [6, 4],
                // 'text-opacity': 0.75
            }
        })
        
        .addLayer({
            id:'selected-file',
            source: 'fills',
            filter: notAFolder,
            type:'line', 
            paint: {
                'line-opacity': [...featureState('selected'), 1, 0],
                'line-color': 'steelblue',
                'line-width': 5
                // 'fill-translate': [-4, -11]
            }
        })

        .addLayer({
            id:'file-corner-labels',
            source: 'folder-corner-labels',
            filter: ['==', 'ext', false],
            type:'symbol', 
            layout: {
                ...textStyle,

                'text-anchor': 'top-left',
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [0,14,8,0],
                'icon-anchor': 'top-left',
                'icon-image': 'white',
                // 'icon-translate': {
                //     property: 'cW',
                //     base:2,
                //     stops: [
                //         [{zoom:0, value: 0}, [0,0]],
                //         [{zoom:0, value: 1}, [16,16]],
                //         [{zoom:22, value: 0}, [0,0]],
                //         [{zoom:22, value: 1}, [16 * Math.pow(2,22),16 * Math.pow(2,22)]],
                //     ]
                // },

                'text-field': '{n}.{ext}\n{s}',
                // '{n}',
                'text-size': 12,
                // [
                //     "interpolate", ["exponential",1.25], ["zoom"],
                //     0, [
                //         'case', 
                //         ['boolean', ['==', ['get', 'ext'], false]], 
                //         ['*', 32, ['^',['get', 'w'], 0.5]], 
                //         ['*', 24, ['^',['get', 'w'], 0.5]], 
                //     ],
                //     // zoom is 10 (or greater) -> circle radius will be 5px
                //     22, [
                //         'case', 
                //         ['boolean', ['==', ['get', 'ext'], false]], 
                //         ['*', 16 * Math.pow(2,8), ['^',['get', 'w'], 0.5]], 
                //         ['*', 12 * Math.pow(2,8), ['^',['get', 'w'], 0.5]], 
                //     ]
                // ],
                'text-justify': 'left',
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': [
                    ...featureState('hovered'),
                    'orange',
                    '#333'
                ],
                'icon-opacity': 0.5,
                // 'text-halo-width': 2,
                // 'text-halo-color': '#333',
                'text-translate': [6, 4],
                // 'text-opacity': 0.75
            }
        })

    map.on('click', on.click)
        .on('zoom', on.zoom)
        .on('move', on.move)
        .on('moveend', on.moveEnd)
        .on('mousemove', on.mousemove)
        // .once('zoomend', app.on.zoomend)
    // .on('mousedown', e=>console.log(e))
    
    // initial load
    openFolder(root, r => {
        app.updateFiles(r,0);
        on.zoom();
    } );
})

var notAFolder = ['!=', 'ext', false];
var isFolderBool = ['boolean', ['==', ['get', 'ext'], false]];
var fileColorRule = [
    'match', 
    ['get', 't'],
    'image','maroon', 
    'video', 'steelblue',
    'audio', 'tan',
    'text', '#666',
    'application', 'purple',
    'green'
];

var textStyle = {
    'text-letter-spacing': 0.05,
    'text-allow-overlap': true
}
function featureState(param) {
    return ['case', ['boolean', ['feature-state', param], false]]
}