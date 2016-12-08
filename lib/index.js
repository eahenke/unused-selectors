#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var args = process.argv.slice(2);
var ignoredDirectories = ['.git'];
var FEW_SELECTORS = 5;

/* Output file for long lists */
var outputFileName = args[1] || './unused-selectors.txt';

//Check given directory exists
var startDir = args[0] || '.';
if (!fs.existsSync(startDir))
{
    console.log('Could not find directory ' + startDir);
    return;
}


var htmlFiles = walkSync(startDir, [], '.html');
var cssFiles = walkSync(startDir, [], ['.css', '.sass', '.scss']);

var htmlPatterns = [
{
    name: 'classes',
    matchOn: /class=['"](.*?)['"]/gi,
    remove: /class=|"|'/g,
    splitOn: ' ',
    addFns: [ngClass],
},
{
    name: 'ids',
    matchOn: /id=['"](.*?)['"]/gi,
    remove: /id=|"|'/g,
}];

var cssPatterns = [
{
    name: 'classes',
    matchOn: /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/gi,
    remove: /[\.\s\n]/gi,
},
{
    name: 'ids',
    //Prevent matches on hex color strings
    matchOn: /\#(?!([A-Fa-f0-9]{3}){1,2})(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/gi,
    remove: /[\#\s\n]/gi,
}];


var allFiles = [getSelectorsInFiles(htmlFiles, htmlPatterns, 'html'), getSelectorsInFiles(cssFiles, cssPatterns, 'css')];

Promise.all(allFiles).then(function (res)
{
    var htmlSelectors, cssSelectors;

    res.forEach(function (r)
    {
        if (r.type === 'html') htmlSelectors = r.selectors;
        else if (r.type === 'css') cssSelectors = r.selectors;
    });

    var extraClasses = diff(cssSelectors.classes, htmlSelectors.classes);
    var extraIds = diff(cssSelectors.ids, htmlSelectors.ids);

    if (extraClasses.length > FEW_SELECTORS || extraIds.length > FEW_SELECTORS)
    {
        writeResults(extraClasses, extraIds);
    }
    else
    {
        //Print to console if there are very few
        console.log('\nUnused class selectors: ');
        console.log(extraClasses);
        console.log('\nUnused ID selectors: ');
        console.log(extraIds);
    }

});



/* Framework specific */
function ngClass(data)
{
    var ngClassObjs = data.match(/ng-class="(.*?)"/gi);

    ngClasses = [];

    ngClassObjs.forEach(function (ng, idx)
    {
        ng = ng.replace(/ng-class=|"/gi, '');

        //Check if it's using object format
        var keys = ng.match(/({|(,\s))'(.*?)(?=:)/gi);
        if (keys && keys.length)
        {
            var flatKeys = [];
            keys = keys.forEach(function (k)
            {
                k = k.replace(/[\',{]/g, '');
                flatKeys = flatKeys.concat(k.split(' ').filter(function (i)
                {
                    return !!i;
                }));
            });
            ngClasses = ngClasses.concat(flatKeys);
            return;
        }

        //Convert quotes for JSON.parse
        ng = ng.replace(/\'/g, '\"');

        //Try to parse array format, fail silently
        try
        {
            ng = JSON.parse(ng);
            if (Object.prototype.toString.call(ng).slice(8, -1) === 'Array') ngClasses = ngClasses.concat(ng);
            else return;
        }
        catch (e)
        {
            return;
        }

    });
    return ngClasses;
}



/* Read/Write files */

function writeResults(classes, ids)
{
    try
    {
        var classList = '## Unused Class Selectors - ' + classes.length + ' ##\n';
        classes.forEach(function (c)
        {
            classList += '\n\t' + '.' + c;
        });
        var idList = '## Unused ID Selectors - ' + ids.length + ' ##\n';
        ids.forEach(function (i)
        {
            idList += '\n\t' + '#' + i;
        });

        var toWrite = classList + '\n\n' + idList;

        fs.writeFile(outputFileName, toWrite, function (e)
        {
            if (e)
            {
                console.log('## Error ##');
                console.log(e);
            }
            else
            {
                console.log('File written to ' + outputFileName);
            }
        });
    }
    catch (e)
    {
        console.log('## Error ##');
        console.log(e);
    }
}


//Find classes/ids in html files
function getSelectorsInFiles(files, patterns, type)
{
    var filesToRead = [];
    var totalSelectors = {};

    files.forEach(function (file)
    {
        filesToRead.push(readFilePromise(file));
    });

    return Promise.all(filesToRead).then(function (result)
    {
        var data = result.join('\n');
        var addOnClasses = [];

        patterns.forEach(function (pattern)
        {
            var flatten = [];
            var selectors = data.match(pattern.matchOn);
            if (selectors)
            {
                if (pattern.remove)
                {
                    selectors = selectors.map(function (s)
                    {
                        s = s.replace(pattern.remove, '');
                        if (pattern.splitOn)
                        {
                            s = s.split(pattern.splitOn);
                        }
                        return s;
                    });
                }
                if (pattern.splitOn)
                {
                    selectors.forEach(function (s)
                    {
                        flatten = flatten.concat(s);
                    });
                }

                flatten = flatten.length ? flatten : selectors;
                flatten = uniq(flatten);
            }

            if (pattern.addFns)
            {
                pattern.addFns.forEach(function (fn)
                {
                    addOnClasses = addOnClasses.concat(fn(data));
                });
            }

            flatten = flatten.concat(uniq(addOnClasses));
            totalSelectors[pattern.name] = flatten || [];
        });

        return {
            type: type,
            selectors: totalSelectors,
        };
    }).catch(function (e)
    {
        console.log('## Error ##');
        console.log(e);
    });
}

function readFilePromise(file)
{
    return new Promise(function (resolve, reject)
    {
        fs.readFile(file, 'utf8', function (err, data)
        {
            if (err) return reject(err);
            return resolve(data);
        });
    });
}


/* Utilities */
function uniq(a)
{
    var used = {};
    return a.filter(function (i)
    {
        return used.hasOwnProperty(i) ? false : (used[i] = true);
    });
}

function diff(a, b)
{
    var used = {};
    var diff = [];
    for (var i = b.length; i--;)
    {
        used[b[i]] = null;
    }

    for (var i = a.length; i--;)
    {
        if (!used.hasOwnProperty([a[i]])) diff.push(a[i]);
    }
    return diff;
}

// List all files in a directory in Node.js recursively in a synchronous fashion
function walkSync(dir, filelist, extensions)
{

    if (typeof extensions === 'string') extensions = [extensions];

    //Ignore certain directories
    for (var i = 0; i < ignoredDirectories.length; i++)
    {
        if (dir.indexOf(ignoredDirectories[i]) >= 0) return filelist;
    }

    //Recursively get files with given extensions
    var files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file)
    {
        if (fs.statSync(path.join(dir, file)).isDirectory())
        {
            filelist = walkSync(path.join(dir, file), filelist, extensions);
        }
        else
        {
            if (extensions.indexOf(path.extname(file)) < 0) return;
            filelist.push(dir + '/' + file);
        }
    });
    return filelist;
}
