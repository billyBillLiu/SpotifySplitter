import { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios';
import SpotifyAuth from './components/SpotifyAuth';
import GetPlaylist from './components/GetPlaylists';
import Login from './components/Login';
import Register from './components/Register';
import noImage from './assets/noimage.png';
import playlistCover from './assets/playlistcover.js';

const App = () => {  
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentUser') || -1);
  const [regForm, setRegForm] = useState(false);
  const [loginStatus, setLoginStatus] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [accessToken, setAccessToken] = useState('');
  const [spotifyID, setSpotifyID] = useState('');

  useEffect(() => {
    localStorage.setItem('currentUser', currentUser);

    axios.post("http://localhost:3001/api/getUser", {
            user_id: currentUser
        })
        .then(res => {
          setDisplayName(res.data[0].username)
          setAccessToken(res.data[0].access_token)
        })
        .catch(err => console.log(err));
        
    if (currentUser == -1) {
      setLoginStatus(false);
    } else {
      setLoginStatus(true);
    }
    
    if (window.location.hash) {
      const hash = window.location.hash;
      const access_token = hash.substring(1)
                          .split('&')
                          .find(string => string.startsWith('access_token'))
                          .split('=')[1];
      storeAccessToken(access_token);
      window.location.href = '';
    }

    if (accessToken) {
      try {
        axios.get("https://api.spotify.com/v1/me", {
          headers: {
            Authorization: "Bearer " + accessToken
          }
        })
        .then(user => setSpotifyID(user.data.id))
      } catch (err) {
        storeAccessToken('');
      }
    }

  }, [currentUser, accessToken]);


  const toggleForm = () => {
    if (regForm) {
      setRegForm(false);
    } else {
      setRegForm(true);
    }
  }

  const logout = () => {
    setCurrentUser(-1);
    localStorage.setItem('currentUser', -1)
  }

  const storeAccessToken = (access_token) => {
    axios.post("http://localhost:3001/api/updateToken", {
      user_id: currentUser,
      access_token: access_token
    });
  }

  const getTracks = async (track_endpoint) => {
    const response = await axios.get(track_endpoint, {
      headers: {
        Authorization: "Bearer " + accessToken
      }
    })
    return response.data.items;
  }

  const splitByGenre = async (tracks) => {
    let split_tracks = {}
    for (const song of tracks) {
      const response = await axios.get('https://api.spotify.com/v1/artists/' + song.track.artists[0].id, {
        headers: {
          Authorization: "Bearer " + accessToken
        }
      })
      let genre = response.data.genres[0];
      let track_id = song.track.id;
      if (genre in split_tracks) {
        split_tracks[genre].push(track_id);
      } else {
        split_tracks[genre] = [track_id];
      }
    }
    return split_tracks;
  }

  const createPlaylist = async (genre, playlist_name) => {
    const response = await axios.post(`https://api.spotify.com/v1/users/${spotifyID}/playlists`, 
      {
        name: 'SpotifySplitter: ' + genre + ' songs from ' + playlist_name,
        description: 'A playlist generated by SpotifySplitter React Web App',
      },
      {
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": 'application/json'
        }
      }
    )

    axios.put('https://api.spotify.com/v1/playlists/' + response.data.id + '/images',
    playlistCover, {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type':  'image/jpeg'
    }}).catch(err => console.log(err));

    return response.data.id;
  };

  const addTrackToPlaylist = async (playlist_id, tracksURIs) => {
    axios.post('https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
      {
        'uris': tracksURIs
      },
      {
        headers: {
          Authorization: 'Bearer ' + accessToken,
          "Content-Type": 'application/json'
        },
      }
    );
  }

  const handleSplitting = async (playlist) => {
    console.log("playlist:")
    console.log(playlist)
    let tracks = await getTracks(playlist.tracks.href);
    let split_tracks = await splitByGenre(tracks);
    for (const genre in split_tracks) {
      let playlist_id = await createPlaylist(genre, playlist.name);
      let trackURIs = split_tracks[genre].map(track => 'spotify:track:' + track);
      console.log(playlist_id);
      console.log(trackURIs);
      addTrackToPlaylist(playlist_id, trackURIs);
    }
  }

  return (
      <div>
        {!loginStatus ? (
          regForm ? 
          <Register onToggleForm={toggleForm}/> 
          : 
          <Login onToggleForm={toggleForm} setCurrentUser={setCurrentUser}/>
        ) : (
          <div>
            <h1>Spotify Playlist Genre Organizer</h1>

            <SpotifyAuth /><br /><br />
            {accessToken ? (
              <><GetPlaylist accessToken={accessToken} setPlaylists={setPlaylists}/><br /></>
              )
            : null}
            
            {playlists ? (<h2>Click On Playlist to Split It by Genre</h2>) : null}
            {playlists ? playlists.map((playlist) => {
              return (
                <a 
                  key={playlist}
                  onClick={() => handleSplitting(playlist)}>
                    <div className='playlists'>            
                      <img src={playlist.images[0] ? playlist.images[0].url : noImage} className='playlist-img'/>
                      <p>{playlist.name}</p>
                    </div>
                </a>
              )
            }) : null}<br />

            <button onClick={logout}>Logout</button>

            <p>Current User: {displayName} ({currentUser})</p>


            {spotifyID ? (
              <p>Spotify ID: {spotifyID}</p>
            ) : null}

            {accessToken ? (
              <p>Access Token: {accessToken}</p>
            ) : null}

          </div>
        )}
      </div>
  );
};

export default App;