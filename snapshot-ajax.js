/*

	TODO:
	- clean web folder on init
	- clean db on init

*/
'use strict'

// Settings
const config = {
	dbPath: __dirname + '/links.db',
	outputPath: __dirname + '/output',
	extension: 'html'
	waitTime: 2000
}

// Modules and constructors
const Datastore = require('nedb'),
	db = new Datastore({
		filename: config.dbPath,
		autoload: true
	})
	Nightmare = require('nightmare'),
	nm = Nightmare({
		show: true
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
		parsed: false
	}, err => {
		if(err){
			console.log('init() failed: ', err)
		}
		console.log('Added link: ', link)
		console.log('Init complete!')
	})
}


// Starts the process of parsing links
function findLink(){
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

function parseLink(link){
	nm
		.goto(link)
		.wait(config.waitTime)
		.evaluate(function(){
			let links = document.querySelectorAll('a'),
				paths = [],
				i
			for(i = links.length; i--;){
				if(paths.indexOf(links[i]) === -1){
					paths.push(links[i])
				}
			}
			return {
				doc: '<!DOCTYPE html>' + document.documentElement.outerHTML,
				links: paths
			}
		})
		.then(obj => {
			// Get path
			let path = link.split('/')
			path.shift()
			path.shift()
			path.shift()
			path = path.join('/')

			// Get filename or detect index
			let name = path[path.length - 1]
			if(name.indexOf('.') !== -1){
				path.pop()
				name = name.split('.')
				name.pop()
				name = name.join('.') + '.' + config.extension
			}
			else{
				name = 'index.' + config.extension
			}
			createFile(obj)


		})
		.catch(err => {
			console.log('parseLink() failed: ', err)
		})
}

function createFile(obj){

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
			// Mark as parsed
			db.update({link: link}, {parsed: true}, {}, err => {
				if(err){
					console.log('update() failed: ', err)
					// Insert new links
					insertLinks(obj.links)
				}
			})
		})
	}
}

function insertLinks(links){
	if(links.length){
		db.find({link: links[0]}).limit(1).exec((err, docs) => {
			if(err){
				console.log('find() failed: ', err)
			}
			if(!docs.length){
				db.insert({
					link: links[0],
					parsed: false
				}, err => {
					if(err){
						console.log('insert() failed: ', err)
					}
					links.shift()
					insertLinks(links)
				})
			}
		})
	}
	// If done, start on new link
	else{
		findLink()
	}
}
































