import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('voter-search');
  const [voterSearch, setVoterSearch] = useState('');
  const [foundVoter, setFoundVoter] = useState(null);
  const [voterError, setVoterError] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState({});
  const [positions, setPositions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [results, setResults] = useState(null);

  // Check if device has already voted
  useEffect(() => {
    checkDeviceVoteStatus();
  }, []);

  const checkDeviceVoteStatus = async () => {
    // Simple device ID based on user agent and screen info
    const deviceId = `${navigator.userAgent}${screen.width}${screen.height}`;
    const { data } = await supabase
      .from('votes')
      .select('id')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (data) {
      setHasVoted(true);
      setCurrentView('already-voted');
    }
  };

  const searchVoter = async () => {
    if (!voterSearch.trim()) {
      setVoterError('Please enter your name');
      return;
    }

    const { data, error } = await supabase
      .from('voters')
      .select('*')
      .ilike('name', `%${voterSearch.trim()}%`)
      .maybeSingle();

    if (error) {
      setVoterError('Error searching voter: ' + error.message);
      return;
    }

    if (!data) {
      setVoterError('Voter not found. Please check your name and try again.');
      return;
    }

    if (data.has_voted) {
      setHasVoted(true);
      setCurrentView('already-voted');
      return;
    }

    setFoundVoter(data);
    setVoterError('');
    setCurrentView('voter-details');
  };

  const handleProceedToVote = () => {
    setCurrentView('provisional-upload');
  };

  const handlePhotoUpload = () => {
    // Simulate photo upload process
    setTimeout(() => {
      loadCandidates();
      setCurrentView('voting-screen');
    }, 2000);
  };

  const loadCandidates = async () => {
    // Get unique positions from candidates table
    const { data: positionsData, error } = await supabase
      .from('candidates')
      .select('position')
      .not('position', 'is', null);

    if (error) {
      console.error('Error loading positions:', error);
      return;
    }

    const uniquePositions = [...new Set(positionsData.map(p => p.position))].sort();
    
    // Get candidates for each position
    const positionsWithCandidates = await Promise.all(
      uniquePositions.map(async (positionTitle) => {
        const { data: candidates } = await supabase
          .from('candidates')
          .select('*')
          .eq('position', positionTitle)
          .order('name');

        return {
          title: positionTitle,
          candidates: candidates || []
        };
      })
    );

    setPositions(positionsWithCandidates);
  };

  const handleVoteSelection = (positionTitle, candidateId) => {
    setSelectedCandidates(prev => ({
      ...prev,
      [positionTitle]: candidateId
    }));
  };

  const submitVotes = async () => {
    if (!foundVoter || Object.keys(selectedCandidates).length !== positions.length) {
      alert('Please select a candidate for every position.');
      return;
    }

    const deviceId = `${navigator.userAgent}${screen.width}${screen.height}`;
    const votePromises = [];

    for (const [positionTitle, candidateId] of Object.entries(selectedCandidates)) {
      votePromises.push(
        supabase.from('votes').insert([{
          voter_id: foundVoter.id,
          candidate_id: candidateId,
          position: positionTitle,
          device_id: deviceId,
          created_at: new Date().toISOString()
        }])
      );
    }

    // Mark voter as voted
    votePromises.push(
      supabase
        .from('voters')
        .update({ has_voted: true })
        .eq('id', foundVoter.id)
    );

    try {
      const results = await Promise.all(votePromises);
      const hasError = results.some(result => result.error);

      if (hasError) {
        alert('Error submitting votes. Please try again.');
        return;
      }

      setVoteSuccess(true);
      setHasVoted(true);
      loadResults(); // Load results to show percentages
      setCurrentView('thank-you');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const loadResults = async () => {
    // This would typically be a database view or function
    // For now, we'll simulate loading results
    setResults({
      president: { candidateA: 45, candidateB: 55 },
      vicePresident: { candidateC: 60, candidateD: 40 }
    });
  };

  const resetProcess = () => {
    setVoterSearch('');
    setFoundVoter(null);
    setSelectedCandidates({});
    setCurrentView('voter-search');
    setVoteSuccess(false);
  };

  // Render different views based on currentView state
  const renderCurrentView = () => {
    switch (currentView) {
      case 'voter-search':
        return (
          <div className="view-container">
            <div className="header">
              <h1>FUMI Elections 2024</h1>
              <p>Federation For Uganda Medical Interns</p>
            </div>
            <div className="search-box">
              <h2>Find Your Voter Profile</h2>
              <input
                type="text"
                placeholder="Enter your full name..."
                value={voterSearch}
                onChange={(e) => setVoterSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchVoter()}
              />
              <button onClick={searchVoter}>Search</button>
              {voterError && <p className="error">{voterError}</p>}
            </div>
            <div className="admin-access">
              <button onClick={() => setCurrentView('admin-login')} className="admin-btn">
                Admin Login
              </button>
            </div>
          </div>
        );

      case 'voter-details':
        return (
          <div className="view-container">
            <h2>Voter Information</h2>
            <div className="voter-details">
              <p><strong>Name:</strong> {foundVoter.name}</p>
              <p><strong>University:</strong> {foundVoter.university}</p>
              <p><strong>Qualification:</strong> {foundVoter.qualification}</p>
              <p><strong>Nationality:</strong> {foundVoter.nationality}</p>
              <p><strong>Completion Year:</strong> {foundVoter.completion_year}</p>
              <p><strong>Internship Center:</strong> {foundVoter.internship_center}</p>
            </div>
            <button onClick={handleProceedToVote}>Proceed to Vote</button>
            <button onClick={resetProcess} className="back-btn">Back to Search</button>
          </div>
        );

      case 'provisional-upload':
        return (
          <div className="view-container">
            <h2>Identity Verification</h2>
            <p>Please upload a clear photo of your provisional license for verification.</p>
            <p><em>(This is required to proceed to the voting ballot)</em></p>
            
            <div className="upload-box">
              <input 
                type="file" 
                accept="image/*" 
                capture="camera" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    // Simulate a 5-second verification process
                    setTimeout(() => {
                      alert("✅ Verification successful! Photo accepted.");
                      loadCandidates();
                      setCurrentView('voting-screen');
                    }, 5000); // Simulate a 5 second "verification" process
                  }
                }}
              />
              <p className="upload-hint">📸 Tap to open your camera or select a photo from your gallery</p>
            </div>
            
            <button onClick={() => setCurrentView('voter-details')} className="back-btn">
              Back to Details
            </button>
          </div>
        );

      case 'voting-screen':
        return (
          <div className="view-container">
            <h2>Cast Your Vote</h2>
            <p>Please select one candidate for each position.</p>
            
            {positions.map((position, index) => (
              <div key={index} className="position-section">
                <h3>{position.title}</h3>
                <div className="candidates-list">
                  {position.candidates.map(candidate => (
                    <label key={candidate.id} className="candidate-option">
                      <input
                        type="radio"
                        name={position.title}
                        value={candidate.id}
                        checked={selectedCandidates[position.title] === candidate.id}
                        onChange={() => handleVoteSelection(position.title, candidate.id)}
                      />
                      <span>{candidate.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button 
              onClick={submitVotes}
              disabled={Object.keys(selectedCandidates).length !== positions.length}
              className="submit-votes-btn"
            >
              Submit All Votes
            </button>
          </div>
        );

      case 'thank-you':
        return (
          <div className="view-container">
            <div className="thank-you-message">
              <h2>Thank You for Voting!</h2>
              <p>Your vote has been successfully recorded.</p>
              {results && (
                <div className="results-preview">
                  <h3>Current Results (Percentages)</h3>
                  {/* Results display would go here */}
                </div>
              )}
            </div>
          </div>
        );

      case 'already-voted':
        return (
          <div className="view-container">
            <div className="already-voted">
              <h2>Voting Complete</h2>
              <p>You have already voted in this election.</p>
              <p>Thank you for participating in the FUMI elections.</p>
              <button onClick={resetProcess} className="back-btn">
                Return to Home
              </button>
            </div>
          </div>
        );

      case 'admin-login':
        return (
          <div className="view-container">
            <h2>Admin Login</h2>
            <div className="admin-login-form">
              <input type="text" placeholder="Username" />
              <input type="password" placeholder="Password" />
              <button onClick={() => alert('Admin login functionality will be implemented')}>
                Login
              </button>
              <button onClick={() => setCurrentView('voter-search')} className="back-btn">
                Back to Voter Login
              </button>
            </div>
          </div>
        );

      default:
        return <div>Page not found</div>;
    }
  };

  return <div className="app">{renderCurrentView()}</div>;
}

export default App;
