document.addEventListener('keydown', e=>{
    if (e.which === 32) state.preview = !state.preview
})

const on = {

    move: e => {
        
        state.lastMove = Date.now();
        const zoom = map.getZoom();
        
        // check if folders need opening
        app.queryMap(undefined, {layers:['folders'], filter:['<=', 'mZP', zoom]})
            .forEach(f => {
                
                const {properties:{i}} = f;
                const folder = state.directory.getFile(i);
                if (!folder.isFolder) return;

                if (!folder.c) {
                    folder.c = 'pending';

                    openFolder(folder.path, r=>app.updateFiles(r, i) )
                }
            })

        app.loadThumbnails();
    },

    mousemove: e=> on.hover(e),

    moveStart: () => {
        console.log('starting')
        app.drawer.classed('moving', true)
        state.moving = true;
    },

    moveEnd: () => {
        state.moving = false;
        app.loadThumbnails();

    },

    zoom: () => {

        const {lastStyleUpdate} = state;

        const since = performance.now()-lastStyleUpdate
        if (since < 50) {
            // console.log('debounce', since)
            return
        }

        state.lastStyleUpdate = performance.now();
        
        const z = map.getZoom();
        const atLeastZoom = ['<=', 'mZ', z];
        const {noValidate} = constants;
        
        map
                
            // update label visibility 
            .setFilter(
                'label', 
                ['all', atLeastZoom, notAFolder],
                noValidate
            )
            // update folder label visibility 
            .setFilter(
                'folder-label', 
                ['all', atLeastZoom, ['==', 'ext', false], ['any', ['>=', 'MZ', z], ['!has', 'MZ']]],
                noValidate
            )
            .setFilter(
                'folder-details', 
                ['all', atLeastZoom, ['==', 'ext', false], ['any', ['>=', 'MZ', z], ['!has', 'MZ']]],
                noValidate
            )
            // update corner folder label visibility 
            .setFilter(
                'folder-corner-labels', 
                ['all', ['==', 'ext', false], ['any', ['<=', 'MZ', z], ['!has', 'MZ']]],
                noValidate
            )
            .setFilter(
                'folder-outline', 
                ['all', ['==', 'ext', false], ['any', ['<=', 'mZP', z], ['!has', 'mZP']]],
                noValidate
            )
            .setFilter(
                'file-corner-labels', 
                ['all', notAFolder, ['==', 't', 'image'], ['any', ['<=', 'MZ', z], ['!has', 'MZ']]],
                noValidate
            )
            // update icon visibility
            .setFilter(
                'file-icon-dot', 
                ['all', notAFolder, ['>=', 'mSTZ', z]  ],
                noValidate
            )

            // update icon visibility
            .setFilter(
                'file-icon-text', 
                ['all', notAFolder, ['<=', 'mSTZ', z] ],
                noValidate
            )
            
    },

    zoomend: e => {

    },

    zoomIn: () => {
        console.log('zi')
    },

    zoomOut: () => {
    },

    click: e => {
 
        const [clickedFile] = app.queryMap(e, {layers: ['file-hit-test']});
        const {directory} = state;

        // double click
        const now = performance.now();
        if (now - state.lastClick < 400) {
            
            if (clickedFile) {
                const { i } = clickedFile.properties;

                const filePath = directory.getFile(i).path;
                fetch(`./open?${filePath}`, ()=>{})
            }

        }

        // single click
        else {
            
            state.lastClick = now;

            // if clicked a file and zoomed in enough, interpret as file selection
            const selectingFile = map.getZoom() > clickedFile?.properties.mZ+1;

            if (selectingFile) {
                app.selected.remove();
                app.selected.create(clickedFile.properties.i)
                return
            }

            // otherwise, interpret as fit viewport to folder
            const {pt, w} = directory.getFile(state.hoverId);
            map.fitBounds(
                utils.getBbox(w, w, pt), 
                {linear: true, padding: 100}
            );

            app.selected.remove();

        }
    },

    hover: e => {

        // hover effect on folder labels, and folder polygons as fallback
        const hoveredLabel = app.queryMap(e, {layers: ['file-hit-test', 'folders', 'folder-label']})[0] 
        
        //|| app.queryMap(e, {layers: ['folder-label']})[0];

        const noChange = (hoveredLabel?.properties.i || 0) === state.hoverId;

        // end early if no change
        if (noChange) return

        // starting to hover, or changing hover
        if (hoveredLabel) {

            const {i, ext} = hoveredLabel.properties;
            cursor( ext ? 'pointer' : 'zoom-in');

            if (state.hoverId) app.hovered.remove();
            app.hovered.create(i);
        }

        // ending hover
        else {
            app.hovered.remove();
            cursor();
        }

    }
}

function cursor(type) {
    document.querySelector('canvas').style.cursor = type || 'default';
}