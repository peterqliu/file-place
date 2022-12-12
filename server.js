
const express = require('express')
const cors = require('cors');
var path = require('path');
const fs = require('fs');
const open = require('open');
const sharp = require('sharp');
const mt = require('mime-types');
const sizeOf = require('image-size')

const bric = require('./server/bric.js');
const app = express();


app.use(cors({origin: null}));

app.use("/", express.static(path.join(__dirname, "/")));

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/'));
});


app.listen(8000, () => {
    console.log('Server on port 8000!')
});

// read contents of folder
app.get('/readDirectory', (req, res)=>{
    const {p: path} = req.query;
    readDirectory(path, payload => res.send(payload));

});

// pass image file 
app.get('/getFile.png', (req, res)=>{
    const [query] = Object.keys(req.query);
    res.sendFile(query);

});

// pass image preview with dimension (square)
app.get('/getPreview.png', (req, res) => {

    try {
        const [query, ratio, width, square] = req._parsedUrl.query.split('&');
        const r = parseFloat(ratio);
        const w = parseFloat(width*50);
    
        const resizeArguments = square ? [256, 256, {fit: 'cover'}] : [256];//[Math.round(256*(1-w)), Math.round(256*r*(1-w/r))];
    
        sharp(query, {failOn: 'none'})
            // .metadata((e,d)=>console.log(d.width, d.height))
            .resize(...resizeArguments)
            .toBuffer()
            .then(buffer => res.send(buffer))
            .catch(err=>res.send(err, query, 'sharperror'))
    }

    catch {res.send('error')}


});

//open file
app.get('/open', (req, res)=>{
    const query = Object.keys(req.query)[0];
    console.log('open', query)
    open(query)
    res.send('success')
});

app.get('/test', (req, res) =>{
    console.log('PING')
    res.send('test')
})

function readDirectory(_path, cb) {

    var layout = 'grid';
    fs.readdir(_path, (e,r) => {

        // if error, return empty array
        if (e) {
            console.error(e); 
            cb({layout: undefined, items:[]})
            return
        }
        r = r.filter(n => n[0] !== '.');

        // if empty, end early
        if (!r.length) {
            cb({layout: 'grid', items: []})
            return
        }

        var output =  r
            .map(n => {

                const childPath = `${_path}/${n}`;
                const stats = fs.statSync(childPath)
                const isFolder = stats.isDirectory();
                const type = (mt.lookup(n) || undefined)?.split('/')[0];
                const isImage = type === 'image' ? _getDimension(childPath): false
                const px = isImage;

                if (isImage) layout = 'bric'

                const extname = path.extname(n);
                return {
                    name: isFolder ? n : n.replace(extname, ''), 
                    ext: isFolder ? false : extname,
                    f: isFolder,
                    t: type,
                    s: stats.size,
                    ...(isImage) && {px: [px.width, px.height]},
                    ...(isFolder) && {q: fs.readdirSync(childPath).length}
                }
            })

        output = bric(

            output.map(f => ({
                width: f?.px?.[0] || 100, 
                height: f?.px?.[1] || 100,
            }))
        )
        .map((f,i)=>({...f, ...output[i]}));

        if (output.length > 500) layout = 'grid'
        
        cb({layout: layout, items: output})
    })

}

function _getDimension(imagePath) {

    var output;
    try {output = sizeOf(imagePath);}
    

    catch {
        console.log(imagePath, 'not supported')
        output = {height:1, width:1, type: false};
    }

    return output

}

