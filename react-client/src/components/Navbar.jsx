import React from 'react';
import LoginDialog from './LoginDialog.jsx';
import SubscribeDialog from './SubscribeDialog.jsx';
import UserMenu from './UserMenu.jsx';

class Navbar extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let authentication = this.props.loggedIn ? (
      <UserMenu
        logout={this.props.logout}
        username={this.props.username} />
    ) : (
        [<p className="control">
          <LoginDialog
            login={this.props.login}
            error={this.props.error} />
        </p>,
        <p className="control">
          <SubscribeDialog
            subscribe={this.props.subscribe} />
        </p>]
      );

    return (
      <nav className="navbar is-transparent">
        <div className="navbar-brand">
          <h1 id="logo">FoodFight!</h1>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <div className="field is-grouped">
              <p className="control">
                <a className="bd-tw-button button" data-social-network="Twitter" data-social-action="tweet" data-social-target="http://localhost:4000" target="_blank" href="https://twitter.com/intent/tweet?text=Let's get ready to Food Fight!">
                  <span className="icon">
                    <i className="fab fa-twitter"></i>
                  </span>
                  <span>
                    Tweet
                  </span>
                </a>
              </p>
              {authentication}
            </div>
          </div>
        </div>
      </nav >
    );
  }
}

export default Navbar;
