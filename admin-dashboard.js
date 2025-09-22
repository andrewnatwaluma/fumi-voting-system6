// admin-dashboard.js - COMPLETELY FIXED VERSION
const supabaseUrl = 'https://iaenttkokcxtiauzjtgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhbmFzZSIsInJlZiI6ImlhZW50dGtva2N4dGlhdXpqdGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NDQ2NDksImV4cCI6MjA3MzQyMDY0OX0.u6ZBX-d_CTNlA94OM7h2JerNpmhuHZxYSXmj0OxRhRI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    const adminRole = localStorage.getItem('adminRole');
    
    if (!adminRole) {
        window.location.href = 'admin-login.html';
        return;
    }

    document.getElementById('currentAdmin').textContent = adminRole;
    
    if (adminRole === 'superadmin') {
        document.getElementById('superAdminSection').style.display = 'block';
    }

    loadAdminStats();
    loadResults();
    loadCandidatesForSuperAdmin();
});

// Load statistics - FIXED
async function loadAdminStats() {
    try {
        const { count: totalVoters, error: votersError } = await supabase
            .from('voters')
            .select('*', { count: 'exact', head: true });

        const { count: votedCount, error: votedError } = await supabase
            .from('voters')
            .select('*', { count: 'exact', head: true })
            .eq('has_voted', true);

        const { count: totalVotes, error: votesError } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true });

        if (votersError || votedError || votesError) {
            console.error('Stats error:', votersError || votedError || votesError);
            document.getElementById('adminStats').innerHTML = '<p>Error loading statistics</p>';
            return;
        }

        const turnout = totalVoters > 0 ? Math.round((votedCount/totalVoters)*100) : 0;
        
        document.getElementById('adminStats').innerHTML = `
            <p>Total Voters: <strong>${totalVoters || 0}</strong></p>
            <p>Voters Who Have Voted: <strong>${votedCount || 0}</strong></p>
            <p>Total Votes Cast: <strong>${totalVotes || 0}</strong></p>
            <p>Voter Turnout: <strong>${turnout}%</strong></p>
        `;
    } catch (error) {
        console.error('Stats loading failed:', error);
        document.getElementById('adminStats').innerHTML = '<p>Error loading statistics</p>';
    }
}

// Load results - FIXED
async function loadResults() {
    try {
        const { data: results, error } = await supabase
            .from('votes')
            .select('candidate_id, candidates (name)');

        if (error) {
            console.error('Results error:', error);
            document.getElementById('adminResultsContainer').innerHTML = '<p>Error loading results</p>';
            return;
        }

        const voteCount = {};
        if (results && results.length > 0) {
            results.forEach(vote => {
                if (vote.candidates && vote.candidates.name) {
                    const candidateName = vote.candidates.name;
                    voteCount[candidateName] = (voteCount[candidateName] || 0) + 1;
                }
            });
        }

        const resultsContainer = document.getElementById('adminResultsContainer');
        resultsContainer.innerHTML = '';

        if (Object.keys(voteCount).length === 0) {
            resultsContainer.innerHTML = '<p>No votes have been cast yet.</p>';
            return;
        }

        for (const [candidateName, votes] of Object.entries(voteCount)) {
            const percentage = results.length > 0 ? Math.round((votes/results.length)*100) : 0;
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-item';
            resultDiv.innerHTML = `
                <h3>${candidateName}</h3>
                <p class="vote-count">${votes} votes</p>
                <p>${percentage}% of total</p>
            `;
            resultsContainer.appendChild(resultDiv);
        }
    } catch (error) {
        console.error('Results loading failed:', error);
        document.getElementById('adminResultsContainer').innerHTML = '<p>Error loading results</p>';
    }
}

// SUPER ADMIN FUNCTIONS - FIXED
async function loadCandidatesForSuperAdmin() {
    try {
        const { data: candidates, error } = await supabase
            .from('candidates')
            .select('*');

        if (error) {
            console.error('Candidates load error:', error);
            return;
        }

        const select = document.getElementById('superAdminCandidateSelect');
        select.innerHTML = '<option value="">Select candidate</option>';
        
        if (candidates && candidates.length > 0) {
            candidates.forEach(candidate => {
                const option = document.createElement('option');
                option.value = candidate.id;
                option.textContent = candidate.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Candidates loading failed:', error);
    }
}

async function lookupVoter() {
    const voterName = document.getElementById('voterLookupName').value.trim();
    const resultDiv = document.getElementById('voterLookupResult');
    
    if (!voterName) {
        resultDiv.innerHTML = '<p class="message">Please enter a voter name</p>';
        return;
    }

    resultDiv.innerHTML = '<p>Searching...</p>';

    try {
        // First try exact match
        let { data: voter, error } = await supabase
            .from('voters')
            .select('*')
            .ilike('name', voterName)
            .maybeSingle();

        // If not found, try partial match
        if (!voter) {
            const { data: voters, error: searchError } = await supabase
                .from('voters')
                .select('*')
                .ilike('name', `%${voterName}%`)
                .limit(1);
            
            if (searchError) throw searchError;
            voter = voters && voters.length > 0 ? voters[0] : null;
        }

        if (error) throw error;

        if (!voter) {
            resultDiv.innerHTML = '<p class="message">Voter not found</p>';
            return;
        }

        // Get vote information separately
        const { data: votes, error: voteError } = await supabase
            .from('votes')
            .select('candidate_id, candidates (name)')
            .eq('voter_id', voter.id)
            .maybeSingle();

        if (voteError) console.error('Vote lookup error:', voteError);

        const votedFor = votes && votes.candidates ? votes.candidates.name : 'Not voted yet';

        resultDiv.innerHTML = `
            <div class="voter-details">
                <p><strong>Name:</strong> ${voter.name}</p>
                <p><strong>University:</strong> ${voter.university || 'N/A'}</p>
                <p><strong>Vote Status:</strong> ${voter.has_voted ? 'Voted' : 'Not voted'}</p>
                <p><strong>Voted For:</strong> ${votedFor}</p>
                <button onclick="selectVoter('${voter.id}', '${voter.name.replace(/'/g, "\\'")}', ${voter.has_voted}, '${votedFor.replace(/'/g, "\\'")}')">
                    Select This Voter
                </button>
            </div>
        `;
    } catch (error) {
        console.error('Search error:', error);
        resultDiv.innerHTML = '<p class="message">Error searching voter</p>';
    }
}

function selectVoter(voterId, voterName, hasVoted, currentCandidate) {
    window.selectedVoterId = voterId;
    document.getElementById('selectedVoterName').textContent = voterName;
    
    let statusText = hasVoted ? 'Already voted' : 'Not voted yet';
    if (hasVoted && currentCandidate !== 'Not voted yet') {
        statusText += ` - Voted for: ${currentCandidate}`;
    }
    
    document.getElementById('voterVoteStatus').textContent = statusText;
    document.getElementById('voterActionSection').style.display = 'block';
}

// FIXED: Added position_id lookup and inclusion
async function changeVote() {
    const candidateId = document.getElementById('superAdminCandidateSelect').value;
    const messageElement = document.getElementById('superAdminMessage');
    
    if (!window.selectedVoterId) {
        messageElement.textContent = 'Please select a voter first';
        return;
    }

    if (!candidateId) {
        messageElement.textContent = 'Please select a candidate';
        return;
    }

    messageElement.textContent = 'Changing vote...';

    try {
        // First, get the candidate's position_id
        const { data: candidate, error: candidateError } = await supabase
            .from('candidates')
            .select('position_id')
            .eq('id', candidateId)
            .single();

        if (candidateError) throw candidateError;
        if (!candidate) throw new Error('Candidate not found');

        // Delete existing vote if any
        const { error: deleteError } = await supabase
            .from('votes')
            .delete()
            .eq('voter_id', window.selectedVoterId);

        if (deleteError && deleteError.code !== '23503') { // Ignore "no rows" error
            throw deleteError;
        }

        // Insert new vote WITH position_id
        const { error: insertError } = await supabase
            .from('votes')
            .insert([{
                voter_id: window.selectedVoterId,
                candidate_id: candidateId,
                position_id: candidate.position_id  // ← CRITICAL FIX: Added position_id
            }]);

        if (insertError) throw insertError;

        // Update voter status
        const { error: updateError } = await supabase
            .from('voters')
            .update({ has_voted: true })
            .eq('id', window.selectedVoterId);

        if (updateError) throw updateError;

        messageElement.textContent = 'Vote successfully changed!';
        messageElement.style.color = 'green';
        
        // Refresh data
        setTimeout(() => {
            loadAdminStats();
            loadResults();
        }, 1000);

    } catch (error) {
        console.error('Vote change error:', error);
        messageElement.textContent = 'Error: ' + error.message;
        messageElement.style.color = 'red';
    }
}

// LOGOUT FUNCTION - FIXED
function logout() {
    localStorage.removeItem('adminRole');
    window.location.href = 'admin-login.html';
}

// Make functions globally available
window.lookupVoter = lookupVoter;
window.selectVoter = selectVoter;
window.changeVote = changeVote;
window.logout = logout;

// Superadmin functions
async function restartElection() {
    const password = prompt("Enter superadmin password to confirm election restart:");
    
    if (password !== "superadmin_password") { // Replace with actual password check
        alert("Invalid password. Election restart cancelled.");
        return;
    }
    
    if (!confirm("WARNING: This will delete ALL votes and reset the election. Are you absolutely sure?")) {
        return;
    }
    
    // Delete all votes
    const { error } = await supabase
        .from('votes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all votes
    
    if (error) {
        console.error("Error deleting votes:", error);
        alert("Error restarting election.");
        return;
    }
    
    // Reset all voters
    const { error: voterError } = await supabase
        .from('voters')
        .update({ has_voted: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (voterError) {
        console.error("Error resetting voters:", voterError);
        alert("Error resetting voters.");
        return;
    }
    
    // Clear device voting flags
    localStorage.removeItem('hasVotedOnThisDevice');
    
    alert("Election has been successfully restarted. All votes have been cleared.");
    location.reload();
}

// Export results to PDF
async function exportResultsPDF() {
    // This would typically use a PDF generation library
    // For now, we'll show a message
    alert("PDF export feature would be implemented here. This would generate a graphical report of election results.");
}

// View voted voters list
async function showVotedVoters() {
    const { data: voters, error } = await supabase
        .from('voted_voters')
        .select('*')
        .order('voted_at', { ascending: false });
    
    if (error) {
        console.error("Error loading voted voters:", error);
        return;
    }
    
    // Display the list of voted voters
    const container = document.getElementById('superAdminContent');
    container.innerHTML = `
        <h3>Voters Who Have Voted (${voters.length})</h3>
        <div style="max-height: 400px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd;">Name</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">University</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Voted At</th>
                    </tr>
                </thead>
                <tbody>
                    ${voters.map(voter => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${voter.name}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${voter.university}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${new Date(voter.voted_at).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
            }
