/*

	TODO:
	- Save internal CSS
	- Save internal JS

*/
'use strict'




// Settings
const config = {
	dbPath: __dirname + '/links.db',
	outputPath: __dirname + '/output',
	extension: 'html',
	waitTime: 3000,
	showBrowser: true,
	autoStart: true
}







// Modules and constructors
const Datastore = require('nedb'),
	db = new Datastore({
		filename: config.dbPath,
		autoload: true
	}),
	Nightmare = require('nightmare'),
	nm = Nightmare({
		show: config.showBrowser
	}),
	fs = require('fs-extra')



// Initiates a starting link
function init(link){
	fs.remove(config.outputPath, (err) => {
		if(err){
			console.log('remove() failed: ', err)
		}
		console.log('Cleaned output folder')
		cleanDb(link)
	})
}

function cleanDb(link){
	db.remove({}, {multi: true}, err => {
		if(err){
			console.log('cleanDb() failed: ', err)
		}
		console.log('Cleaned DB')
		startDb(link)
	})
}
function startDb(link){
	db.insert({
		link: link,
		parsed: false,
		origin: true
	}, err => {
		if(err){
			console.log('init() failed: ', err)
		}
		console.log('Added link: ', link)
		console.log('Init complete!')
		if(config.autoStart){
			start()
		}
	})
}


// Starts the process of parsing links
let origin = ''
function start(){
	console.log('Starting...')
	db.find({origin: true}).limit(1).exec((err, docs) => {
		if(err){
			console.log('start() failed: ', err)
		}
		if(!docs.length){
			console.log('No origin found!')
		}
		else{
			origin = getOrigin(docs[0].link)
			findLink()
		}
	})
}
function findLink(){
	console.log('Querying for link...')
	db.find({parsed: false}).limit(1).exec((err, docs) => {
		if(err){
			console.log('findLink() failed: ', err)
		}
		// If a result was found
		if(docs.length){
			parseLink(docs[0].link)
		}
		// If no results were found, finish
		else{
			console.log('Done!')
		}
	})
}
function getOrigin(str){
	str = str.split('://')[1].split('/')[0]
	if(str.indexOf('www.') === 0){
		str = str.replace('www.', '')
	}
	return str
}

function parseLink(link){
	console.log('Parsing link...')
	nm
		.goto(link)
		.wait(config.waitTime)
		.evaluate(function(origin){


			function getOrigin(str){
				if(!str || str.indexOf('://') === -1){
					return false
				}
				str = str.split('://')[1].split('/')[0]
				if(str.indexOf('www.') === 0){
					str = str.replace('www.', '')
				}
				return str
			}


			let links = document.querySelectorAll('a'),
				paths = [],
				i
			for(i = links.length; i--;){
				// If outbound link
				if(getOrigin(links[i].href) !== origin){
					continue
				}

				// Otherwise, add to paths
				if(paths.indexOf(links[i].href) === -1){
					paths.push(links[i].href)
				}
			}
			return {
				doc: '<!DOCTYPE html>' + document.documentElement.outerHTML,
				links: paths
			}
		}, origin)
		.then(obj => {
			console.log('Page evaluated...')
			// Get path
			let path = link.split('/')
			path.shift()
			path.shift()
			path.shift()
			path = path.join('/')

			// Get filename or detect index
			let name = path[path.length - 1]
			if(name && name.indexOf('.') !== -1){
				path.pop()
				name = name.split('.')
				name.pop()
				name = name.join('.') + '.' + config.extension
			}
			else{
				name = 'index.' + config.extension
			}
			createFile(obj, path, name, link)


		})
		.catch(err => {
			console.log('parseLink() failed: ', err)
		})
}

function createFile(obj, path, name, link){
	console.log('Creating file...')
	// Create file directory
	fs.ensureDir(config.outputPath + '/' + path, err => {
		if(err){
			console.log('ensureDir() failed: ', err)
		}
		// Write file
		fs.writeFile(config.outputPath + '/' + path + '/' + name, obj.doc, err => {
			if(err){
				console.log('writeFile() failed: ', err)
			}
			console.log('Wrote file.')
			// Mark as parsed
			db.update({link: link}, {parsed: true}, {}, err => {
				if(err){
					console.log('update() failed: ', err)
				}
				console.log('Mark as parsed')
				// Insert new links
				insertLinks(obj.links)
			})
		})
	})
}

function insertLinks(links){
	if(links.length){
		console.log('Inserting link: ' + links[0])
		db.find({link: links[0]}).limit(1).exec((err, docs) => {
			if(err){
				console.log('insertLinks() failed: ', err)
			}
			if(!docs.length){
				db.insert({
					link: links[0],
					parsed: false
				}, err => {
					if(err){
						console.log('insert() failed: ', err)
					}
					console.log('Link inserted')
					links.shift()
					insertLinks(links)
				})
			}
			else{
				console.log('Link already exists')
				links.shift()
				insertLinks(links)
			}
		})
	}
	// If done, start on new link
	else{
		console.log('Done inserting links')
		findLink()
	}
}





init('http://trophyridge.com/')
//start()

























