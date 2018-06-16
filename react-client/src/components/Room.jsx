import React from 'react';
import io from 'socket.io-client';
import $ from 'jquery';
import Tock from 'tocktimer';
import RestaurantList from './RestaurantList.jsx';
import CurrentSelection from './CurrentSelection.jsx';
import sizeMe from 'react-sizeme'
import Confetti from 'react-confetti'

class Room extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      message: '',
      messages: [],
      members: [],
      zipcode: undefined,
      currentSelection: undefined,
      currentSelectionName: undefined,
      isNominating: true,
      votes: [],
      roomName: '',
      timer: '',
      winner: {},
      // The hasVoted functionality has not yet been implemented
      hasVoted: false,
    };
    //remove
    console.log('JOSEPH', process.env.PORT);
    this.roomID = this.props.match.params.roomID;

    this.nominateRestaurant = this.nominateRestaurant.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.voteApprove = this.voteApprove.bind(this);
    this.voteVeto = this.voteVeto.bind(this);

    // Client-side socket events
    // NEED THIS TO WORK ON DEPLOYMENT
    this.socket = io({transports: ['websocket']});
    // SERIOUSLY NEED ABOVE FOR DEPLOYMENT
    //DO NOT NEED TO SPECIFY PORT ON CLIENT SIDE
    this.socket.on('chat', message => {
      if (message.roomID === this.roomID) {
        console.log('Received message', message);
        this.setState({
          messages: [...this.state.messages, message.message],
        });
        this.getMessages();
      }
    });
    this.socket.on('vote', roomID => {
      if (roomID === this.roomID) {
        console.log('Received vote');
        this.getVotes();
      }
    });

    this.socket.on('veto', roomID => {
      if (roomID === this.roomID) {
        console.log('Received veto');
        this.getVotes();
      }
    });

    this.socket.on('nominate', nominee => {
      if (nominee.roomID === this.roomID) {
        console.log('Received nomination', nominee);
        this.setState({
          currentSelection: nominee.restaurant,
          hasVoted: false,
        });
      }
    });

    this.socket.on('join', roomID => {
      if (roomID === this.roomID) {
        console.log('Received new member');
        if (this.state.currentSelection) {
          this.socket.emit('nominate', {'restaurant': this.state.currentSelection, 'roomID': this.roomID});
        }
      }
    })
  }

  /// Send post request to server to fetch room info when user visits link
  componentDidMount() {
    this.getMessages();
    this.getRoomInfo();
    this.getTimer();
    this.getVotes();
    this.socket.emit('join', this.roomID);
    this.scrollToBottom();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  scrollToBottom () {
    this.messagesEnd.scrollIntoView({ behavior: "smooth" });
  }

  getMessages() {
    $.get(`/api/messages/${this.roomID}`).then(messages => {
      this.setState({
        messages: messages,
      });
    });
  }

  getRoomInfo() {
    $.get(`/api/rooms/${this.roomID}`).then(roomMembers => {
      console.log(`Got roommembers: ${JSON.stringify(roomMembers)} from ${this.roomID}`)
      this.setState({
        members: roomMembers,
        zipcode: roomMembers[0].rooms[0].zipcode,
        roomName: roomMembers[0].rooms[0].name,
      });
    });
  }

  getTimer() {
    $.get(`/api/timer/${this.roomID}`).then(timer => {
      let tock = new Tock({
        countdown: true,
        interval: 100,
        callback: () => {
          let time = tock.lap()
          let seconds = (Math.floor((time / 1000) % 60));
          let minutes = (Math.floor((time / (60000)) % 60));
          seconds = (seconds < 10) ? "0" + seconds : seconds;
          minutes = (minutes < 10) ? "0" + minutes : minutes;

          this.setState({
            timer: minutes + ':' + seconds
          })
        },
        complete: () => {
          $.get(`/api/getWinner/${this.roomID}`).then(winner => {
            console.log('WINNER: ', winner);
            $.post('/api/search/restaurant', {
              restId: winner
            }).then((winner) => {
              this.setState({
                winner: winner
              })
            })
          });
        }
      });
      console.log('STARTING TIMER');
      tock.start(timer.timeLeft + 1000);
    });
  }

  getVotes() {
    $.get(`/api/votes/${this.roomID}`).then(restaurants => {
      this.setState({
        votes: restaurants,
      });
      if (restaurants.length && !this.state.currentSelection) {
        restaurants.forEach(restaurant => {
          if (!restaurant.vetoed) {
            this.setState({
              currentSelectionName: restaurant.name,
            });
          }
        });
      }
    });
  }

  // Activated on click of RestaurantListItem component
  nominateRestaurant(restaurant, reloading = false) {
    if (this.state.isNominating) {
      this.setState({
        currentSelection: restaurant,
        isNominating: false,
      });
      if (!reloading) {
        let voteObj = {
          name: restaurant.name,
          roomID: this.roomID,
          restaurantID: restaurant.id,
        };
        console.log('vote', voteObj)
        let nomObj = {
          restaurant: restaurant,
          roomID: this.roomID,
        };
        $.post('/api/nominate', voteObj).then(() => {
          this.socket.emit('nominate', nomObj);
        });
      }
      // A user who nominates a restaurant should automatically vote for it
      // Socket is not refreshing table for some reason but still sends vote
      this.voteApprove(restaurant.name, restaurant.id);
    }
  }

  sendMessage() {
    console.log(this.props.username)
    let messageObj = {
      message: {
        name: this.props.username || this.state.name,
        message: this.state.message,
      },
      roomID: this.roomID,
    };
    $.post('/api/messages', messageObj).then(() => {
      this.socket.emit('chat', messageObj);
    });
  }

  handleKeyPress(event) {
    if (event.key == 'Enter') {
      this.sendMessage();
    }
  }

  // Update from text boxes in the live chat
  updateName(e) {
    this.setState({
      name: e.target.value,
    });
  }

  updateMessage(e) {
    this.setState({
      message: e.target.value,
    });
  }

  voteApprove(name, id) {
    let resName = name || this.state.currentSelection.name;
    let resId = id || this.state.currentSelection.id;
    let voteObj = {
      voter: this.props.username,
      restaurant_id: resId,
      name: resName,
      roomID: this.roomID,
    };
    $.post('/api/votes', voteObj).then(() => {
      this.socket.emit('vote', voteObj);
    });
    this.setState({
      hasVoted: true,
    });
  }

  voteVeto() {
    let resId = this.state.currentSelection.id;
    this.setState({
      isNominating: true,
    });
    if (this.state.currentSelection) {
      let voteObj = {
        voter: this.props.username,
        restaurant_id: resId,
        name: this.state.currentSelection.name,
        roomID: this.roomID,
      };
      console.log('INSIDE', voteObj)
      $.post('/api/vetoes', voteObj).then(() => {
        this.setState({
          currentSelection: undefined,
          hasVoted: true,
        });
        this.socket.emit('veto', voteObj);
      });
    }
  }

  render() {
    // get size for confetti
    const { width, height } = this.props.size

    let restaurantList = this.state.zipcode ? (
      <RestaurantList zipcode={this.state.zipcode} nominate={this.nominateRestaurant} currentName={this.currentSelectionName}/>
    ) : (
        ''
      );
    let currentSelection = (this.state.currentSelection && !this.state.isNominating) ? (
      <CurrentSelection restaurant={this.state.currentSelection} />
    ) : (
        <div>Please nominate a restaurant</div>
      );
    return (
      <div>
        {this.state.winner.id ?
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <Confetti width={width} height={height} />
        </div> : ''}
        <section className="hero is-primary">
          <div className="hero-body">
            <div className="container">
              <h1 className="title">
                Welcome to Room {this.state.roomName}
              </h1>
              <h2 className="subtitle">
                <div>
                  Fighters: {this.state.members.map((user, index) => <span key={index}>{user.email} </span>)}
                </div>
                <div>Zipcode: {this.state.zipcode}</div>
              </h2>
            </div>
          </div>
        </section>
        <div className="columns">
          <div
            className="tile is-ancestor"
            style={{ marginTop: '15px' }}>
            <div className="column is-6">
              <div className="tile is-parent">
                {/* <div className="is-divider" /> */}
                <article className="tile is-child notification">
                  <div id="yelp-list">
                    {this.state.winner.id ? 
                    <div>Winner</div> :
                    restaurantList}
                  </div>
                </article>
              </div>
            </div>
            <div className="column">
              <div className="tile is-parent is-vertical">
                {this.state.winner.id ? '' : 
                  <article className="tile is-child notification">
                  <div id="current-restaurant">
                    <p className="title">Time Remaining: {this.state.timer}</p>
                    <p className="title">Current Selection</p>
                    {currentSelection}
                    <button onClick={() => this.voteApprove()} className="button is-success">
                      Approve
            </button>
                    <button onClick={this.voteVeto} className="button is-danger">
                      Veto
            </button>
                    <div>
                      <h3>Scoreboard</h3>
                      <table className="table is-striped is-bordered is-fullwidth">
                        <thead>
                          <th>Restaurant</th>
                          <th>Votes</th>
                        </thead>
                        <tbody>
                          {this.state.votes
                            .sort((a, b) => {
                              return b.votes - a.votes;
                            })
                            .map((restaurant, index) => (
                              // <h5 style={{ backgroundColor: restaurant.vetoed ? 'white' : 'lightgrey' }}>
                              //   <strong>{restaurant.name}</strong> {restaurant.votes}
                              // </h5>
                              <tr key={index}>
                                <td>{restaurant.name}</td>
                                <td>{restaurant.votes}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>}
                <article className="tile is-child notification">
                  <div id="chat">
                    <h4 className="is-size-4">{this.state.roomName} Chatroom</h4>
                    <div className="chat-messages">
                      {this.state.messages.map(message => {
                        if(this.props.username === message.name) {
                          return (<div style={{textAlign:"right", backgroundColor:"#ffe6e6", borderTop:"1px solid black", padding:"5px"}}><p>{message.message}</p></div>)
                        } else {
                          return (<div style={{textAlign:"left", backgroundColor:"#f0f5f5", borderTop:"1px solid black", padding:"5px"}}><p><strong>{message.name}:</strong> {message.message}</p></div>)
                        }
                      })}
                    </div>
                    <div style={{ float:"left", clear: "both" }}
                      ref={(el) => { this.messagesEnd = el; }}>
                    </div>
                    <div>
                      <span>
                            <input
                              type="text"
                              className="input is-primary is-small is-rounded"
                              value={this.state.message}
                              onChange={this.updateMessage.bind(this)}
                              onKeyPress={this.handleKeyPress.bind(this)}
                              style={{width:'450px', marginTop:'15px', marginRight:'15px'}}
                            />
                      </span>
                      <button
                        onClick={this.sendMessage.bind(this)}
                        className="button is-outlined is-primary is-small send-message"
                        style={{marginTop:'15px'}}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// Create size config
const config = { monitorHeight: true }
// Call SizeMe with the config to get back the HOC.
const sizeMeHOC = sizeMe(config)
export default sizeMeHOC(Room)
