var constants = {
    imgExtensions : ['.jpg', '.jpeg', '.png', '.gif', '.svg'],
    interactionDelay: 50,
    folderMargin: 0.05,
    emptyData: {"type":"FeatureCollection", "features": []},
    noValidate: {validate: false},
    p22: Math.pow(2,22),
    minWidth: {
        fileIcon: 50,
        fileLabel: 200,
        imageFetch: 90,
        readFolder: 15
    }
}

var app = {

    isImage: d => d.ext && constants.imgExtensions.some(e=>d.ext.toLowerCase().includes(e)),

    getFileName: path => {
        const lastItem = (path.split('/')).length-1;
        return decodeURIComponent((path.split('/'))[lastItem])
    },

    updateFiles: (newFiles, parentIndex) => {

        const { layout, items } = newFiles;
        const {
            minWidth: {fileIcon, fileLabel, imageFetch, readFolder}, 
            folderMargin
        } = constants;

        const { 
            directory, 
            geojson: {labels, fills, cornerFolderLabels}
        } = state;
        
        const { drawPoint, drawBox, NDCToZoomAtMinPxSize } = utils;

        const parent = directory.getFile(parentIndex);
        parent.c = [];
        parent.l = layout;
        const zoom = map.getZoom();
        

        const [drawerWidth, drawerOffset] = [parent.w * (1-folderMargin*2), parent.w * folderMargin];
        const rows =  Math.ceil(Math.pow(items.length, 0.5));

        // standardized cell width if items were rendered in grid format
        // used for grid layouts, and for line buffers in bric mode
        const cellWidth = drawerWidth/rows;

        const zoomIconAppear = NDCToZoomAtMinPxSize(cellWidth, fileIcon) // minzoom at which file icon appears
        const zoomLabelAppear = NDCToZoomAtMinPxSize(cellWidth, fileLabel) // minzoom at which label appears
        const zoomImageFetch = NDCToZoomAtMinPxSize(cellWidth, imageFetch);

        // set max zoom for parent label so that it doesn't collide with children
        if (parentIndex) {
            labels.features[parentIndex-1].properties.MZ = 
            cornerFolderLabels.features[parentIndex-1].properties.MZ = 
            zoomLabelAppear;
        }
        
        items.forEach((f,i) => {

            const {p, childWidth, childHeight, offset } = packing[layout](f, i, rows, drawerWidth);
            const position = p.map( (d,i) => d + parent.pt[i] + drawerOffset );

            const file = new DirectoryItem({
                n: f.name,
                ext: f.ext,
                p: parentIndex,
                // l: layout,
                q: f.q,
                pt: position,
                w: childWidth,
                r: childHeight/childWidth
            })
            
            // add child to files
            directory.addFile(file)            
            directory.linkChildToParent(directory.files.length-1, parentIndex);

            // props shared by labels and thumbnails
            const props = {
                i: directory.files.length - 1,
                ext: f.f ? false : f.ext.replace('.', ''),
                q: f.q,
                s: f.s,
                MZ: file.isFolder ? 99 : zoomImageFetch, // max zoom of main label (high by default, so that it's visible by default until we fetch contents)
            };

            const pt = drawPoint(
                position.map((c,i)=>c+offset[i]), 
                {
                    ...props, 
                    w: childWidth, 
                    n: file.displayName,
                    t: f.t,
                    mSTZ: zoomIconAppear,
                    mZ: zoomLabelAppear,
                    mZI: app.isImage(f) ? zoomImageFetch : 99 // minzoom at which image sprite is fetched and rendered
                });

            labels.features.push(pt)
            cornerFolderLabels.features
                .push(drawPoint(
                    file.isFolder ? position : position.map(c=>c+cellWidth/64), // nudge file labels a bit to the SE to align to buffered 
                    {...props, 
                        n: f.name, 
                        t: f.t, 
                        s: f.s < 1000 ? `${f.s}bytes` : (f.s < 1000000 ? Math.round(f.s/1000)+'kb' : (f.s/100000).toFixed(2)+'MB')}
                ));

            // polygons for files (hit testing) and folders

            // minzoom at which we fetch contents of folder,
            // depending on its scene size and quantity of items inside
            const mZP = NDCToZoomAtMinPxSize(childWidth, readFolder) + Math.pow(file.q || 0, 0.05)

            fills.features.push(
                drawBox(
                    childWidth, childHeight || childWidth, position, 
                    {
                        ...props, 
                        mZ: NDCToZoomAtMinPxSize(childWidth, 20), // minzoom at which folder/file hit area appears at all
                        mZP: mZP,
                        cW: cellWidth,
                        t: f.t
                    }
                )
            )

            // RECURSION: if this new file itself will be rendered big enough 
            if (file.isFolder && zoom > mZP) {
                file.c = 'pending';
                // console.log('opening', file.n, file)
                openFolder(file.path, subsubitems => {
                    app.updateFiles(subsubitems, file.i)
                })
            } 
        })

        app.updateMapData();

    },

    // setData when all outstanding requests have landed and processed
    updateMapData: () => {

        state.pending.mapDataUpdates--
        if (state.pending.mapDataUpdates) return

        const { geojson: {labels, fills, cornerFolderLabels} } = state;

        map.getSource('pt')
            .setData(labels);

        map.getSource('fills')
            .setData(fills);

        map.getSource('folder-corner-labels')
            .setData(cornerFolderLabels);

    },

    queryMap: (e, options) => map.queryRenderedFeatures(e?.point, options),

    packItems: (ul, lr, items) => {

    },

    renderLoop: () => {

        const { renderLoop, on: {moveStart, moveEnd, move, zoom, zoomIn, zoomOut}} = app;
        const {interactionDelay} = constants;
        const {lastInteraction, moving, willMove, willZoom, zoomDelta } = state;

        if (moving || willMove) {

            // stopping
            if (moving) {
                const now = performance.now();
                if (!willMove && now-lastInteraction > interactionDelay) moveEnd()
            }

            // starting
            else  moveStart()
            
            // moving
            move()

            if (zoomDelta !== 0) {
                zoom();

                if (zoomDelta>0) zoomIn();
                else zoomOut();

                state.zoomDelta = 0;
            }

            state.willMove = false;
        }


        requestAnimationFrame(renderLoop);

    },

    loadThumbnails: e => {

        const zoom = map.getZoom();

        // check if images need fetching
        const features = app.queryMap(
            undefined, 
            {
                layers:[ app.currentThumbLayer ], 
                filter:['all', ['<=', 'mZI', zoom], ['!=', 'ext', false]]
            }
        );

        features
            .forEach(f => {
                
                const { properties:{i, w} } = f;
                const image = state.directory.getFile(i);

                if (!image.fetched) {

                    image.fetched = true;
                    const n = performance.now();

                    utils.addSprite(
                        `./getPreview.png?${image.path}&${image.r}&${image.w}${image.parent.l === 'grid' ? '&t' : ''}`, 
                        `s${i}`, 
                        w, 
                        undefined, 
                        ()=> {
                            const z = Math.floor(map.getZoom());
                            // renderer doesn't reevaluate newly available icons when a fallback has been used
                            // this is a hack to force it to check and render the icon
                            map.setLayoutProperty(`thumbs${z}`, 'visibility', 'none')
                            map.setLayoutProperty(`thumbs${z}`, 'visibility', 'visible')

                        }
                    )
                }
            })
    },


    get currentThumbLayer() {
        return `thumbs${Math.floor(map.getZoom())}`
    },

    selected: {

        create: id => {
            console.log(id)
            state.selectedId = id;
            map.setFeatureState({source: 'fills', id: state.selectedId}, {selected: true})
        },

        remove: () => map.removeFeatureState({source: 'fills', id: state.selectedId}, 'selected')
    },

    hovered: {

        create: id => {
            state.hoverId = id;
            map.setFeatureState({source: 'pt', id: id}, {hovered: true})
            map.setFeatureState({source: 'fills', id: id}, {hovered: true})
        },

        remove: () => {
            map.removeFeatureState({source: 'pt', id: state.hoverId}, 'hovered')
            map.removeFeatureState({source: 'fills', id: state.hoverId}, 'hovered')
        }
    },
}

const packing = {

    grid: (item, i, rows, drawerWidth) => {

        const childWidth = drawerWidth/rows;
        
        // integer coordinates of item within and relative to its folder
        const gridPosition = [(i%rows), Math.floor(i/rows)];

        // global coordinates of item
        const position = gridPosition
            .map((c,i) => c*childWidth);

        return { p: position, childWidth: drawerWidth/rows, offset: [childWidth/2, childWidth/2] }

    },

    bric: (item, i, rows, drawerWidth) => {

        const { w, h, x, y } = item;
        const mil = 1000000;

        return {
            p: ([x,y]).map(c => c * drawerWidth/mil),
            childWidth: w*drawerWidth/mil,
            offset: ([w,h]).map(c => 0.5 * c * drawerWidth/mil),
            childHeight: h*drawerWidth/mil
        }
    }
}
class Directory {

    constructor(options) {

        Object.assign(this, options);
        this.files = [];
    }

    getFile(i) {
        return this.files[i];
    }

    getFileByName(name) {
        return this.files.find(f=>f.n === name)
    }

    addFile(directoryItem) {
        directoryItem.i = this.files.length;
        this.files.push(directoryItem);
    }

    // add reference of this child to parent 

    linkChildToParent(childIndex, parentIndex) {
        this.getFile(parentIndex).c = this.getFile(parentIndex).c || [];
        this.getFile(parentIndex).c.push(childIndex);
    }

    iterate(fn) {
        this.files.forEach((f,i)=>fn(f,i))
    }
}


class DirectoryItem {

    constructor(options) {
        Object.assign(this, options)
    }

    get margin() {

        const {bb: [ul, lr]} = this;
        const mXmY = [Math.abs(ul[0]-lr[0]),Math.abs(ul[1]-lr[1])];
        return Math.min(...mXmY) * constants.folderMargin;
    
    }

    get parent() {
        return state.directory.getFile(this.p)
    }

    get children() {
        if (this.c) return this.c.map(i => state.directory.getFile(i))
        else return false
    }

    get path() {

        var folder = this;

        //assemble directory path
        var path = encodeURI(folder.n);
        const parent = f => state.directory.getFile(f.p);

        while (parent(folder)) {
            path = encodeURI(parent(folder).n)+'/' + path;
            folder = parent(folder);
        }

        return `${path}${this.ext || ''}`
    }

    get isFolder() {
        return this.ext === false
    }

    get displayName() {
        const noFormat = this.n//.split('.')[0];
        const needsTruncation = noFormat.length >= 20 && !noFormat.indexOf(' '); // truncate label if long and no spaces for line breaks (as 1st order approx.) 
        return needsTruncation ? noFormat.substr(0,20)+'...' : noFormat // TODO: use mbxgl slice expression for this?
    }

    geoJSON() {
        return
    }
}