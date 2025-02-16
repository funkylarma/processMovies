const core = require( '@actions/core' );
const github = require( '@actions/github' );
const { processMovieFeed } = require( './process' );
const fs = require( 'fs' );

async function run ( ) {
  await processMovieFeed( 'https://letterboxd.com/funkylarma/rss/' );
  
  try {} catch ( error ) {
    core.setFailed( error.message );
  }
}

run( );