import { useEffect, useState } from 'react'
import Panel from './Panel.jsx'
import Icon from './Icons.jsx'
import { loadGitHubPullRequests } from '../services/github.js'
import { clearGitHubConfig, readGitHubConfig, writeGitHubConfig } from '../utils/storage.js'
import { relativeUpdated } from '../utils/dates.js'

export default function PullRequestsPanel({ index }) {
  const [config, setConfig] = useState(readGitHubConfig)
  const [draftUsername, setDraftUsername] = useState(config.username)
  const [draftToken, setDraftToken] = useState(config.token)
  const [state, setState] = useState({ status: config.username ? 'loading' : 'setup', data: null, error: '' })

  useEffect(() => {
    if (!config.username) return undefined
    let cancelled = false
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })
    loadGitHubPullRequests(config.username, config.token, controller.signal)
      .then((data) => { if (!cancelled) setState({ status: 'ready', data, error: '' }) })
      .catch((error) => { if (!cancelled && error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }) })
    return () => { cancelled = true; controller.abort() }
  }, [config])

  function connect(event) {
    event.preventDefault()
    const username = draftUsername.trim()
    if (!username) return
    const next = { username, token: draftToken.trim() }
    writeGitHubConfig(next)
    setConfig(next)
  }

  function disconnect() {
    clearGitHubConfig()
    setConfig({ username: '', token: '' })
    setDraftUsername('')
    setDraftToken('')
    setState({ status: 'setup', data: null, error: '' })
  }

  const meta = state.status === 'ready' ? <span>{state.data.mine.length} mine &#8226; {state.data.repositories.length} repos</span> : state.status === 'loading' ? <span>syncing...</span> : null
  return <Panel path="~/git/pulls --author=@me" index={index} className="pulls-panel" meta={meta}>
    {!config.username ? <GitHubSetup username={draftUsername} token={draftToken} onUsernameChange={setDraftUsername} onTokenChange={setDraftToken} onSubmit={connect} /> : state.status === 'loading' ? <div className="github-message"><Icon name="loader" size={15} className="accent-text" /> syncing open pull requests for {config.username}...</div> : state.status === 'error' ? <div className="github-message error-message"><strong>github sync failed</strong><span>{state.error}</span><div><button className="github-action" onClick={() => setConfig({ ...config })}>retry</button><button className="github-action" onClick={disconnect}>change account</button></div></div> : <GitHubDataView data={state.data} username={config.username} onDisconnect={disconnect} />}
  </Panel>
}

function GitHubSetup({ username, token, onUsernameChange, onTokenChange, onSubmit }) {
  return <form className="github-setup" onSubmit={onSubmit}>
    <div><Icon name="pullRequest" size={17} className="github-setup-icon accent-text" /><div><strong>Connect GitHub to make this panel live.</strong><p>Enter your username for public repositories. Add a Personal Access Token if you want private repositories and a higher API limit.</p></div></div>
    <div className="github-fields"><label><span>username</span><input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="your-github-name" autoComplete="username" /></label><label><span>token <small>(optional)</small></span><input type="password" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder="github_pat_..." autoComplete="current-password" /></label><button className="github-connect" type="submit">connect <Icon name="arrowUpRight" size={12} /></button></div>
    <small className="github-security-note">For now, the token stays in this browserâ€™s local storage. We can move it to the Windows keychain when we wrap Start in Tauri.</small>
  </form>
}

function GitHubDataView({ data, username, onDisconnect }) {
  const [hiddenPrIds, setHiddenPrIds] = useState(() => new Set())
  const visibleMine = data.mine.filter((pr) => !hiddenPrIds.has(pr.id))
  const visibleRepositories = data.repositories
    .map((repository) => ({ ...repository, pullRequests: repository.pullRequests.filter((pr) => !hiddenPrIds.has(pr.id)) }))
    .filter((repository) => repository.pullRequests.length)

  function hidePullRequest(prId) {
    setHiddenPrIds((current) => new Set([...current, prId]))
  }

  return <div className="github-data"><div className="github-toolbar"><span><Icon name="dot" size={10} className="accent-text" /> connected as {username}</span><button className="github-action" onClick={onDisconnect}>disconnect</button></div><div className="github-scroll-region"><section className="github-section"><div className="github-section-header"><strong>1 &#8226; my open PRs</strong><span>{visibleMine.length}</span></div>{visibleMine.length ? <div className="github-pr-list">{visibleMine.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showRepo onHide={hidePullRequest} />)}</div> : <p className="github-empty">No visible open PRs authored by {username}.</p>}</section><section className="github-section"><div className="github-section-header"><strong>2 &#8226; repos owned by me</strong><span>{visibleRepositories.length}</span></div>{visibleRepositories.length ? <div className="github-repository-list">{visibleRepositories.map((repository) => repository.pullRequests.length > 5 ? <GitHubRepositorySummary key={repository.name} repository={repository} /> : <div className="github-repository-group" key={repository.name}><div className="github-repository-title"><strong>{repository.name}</strong><span>{repository.pullRequests.length} open</span></div>{repository.pullRequests.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showAuthor onHide={hidePullRequest} />)}</div>)}</div> : <p className="github-empty">No visible owned repositories with open PRs.</p>}</section></div></div>
}

function GitHubPRRow({ pr, showRepo, showAuthor, onHide }) {
  return <div className="github-pr-row"><a className="github-pr-link" href={pr.url} target="_blank" rel="noreferrer"><Icon name="pullRequest" size={15} className={`github-pr-icon ${pr.draft ? 'muted-text' : 'accent-text'}`} /><span className="github-pr-copy"><strong>{pr.title}{pr.draft && <small className="draft-label">draft</small>}</strong><small>{showRepo ? `${pr.repo} #${pr.number}` : `#${pr.number}`}{showAuthor ? ` \u2022 opened by ${pr.author}` : ''}{pr.branch ? ` \u2022 ${pr.branch}` : ''}</small></span><span className="github-pr-updated">{relativeUpdated(pr.updatedAt)}</span><Icon name="arrowUpRight" size={13} className="github-external" /></a><button type="button" className="github-pr-hide" onClick={() => onHide(pr.id)} aria-label={`Hide ${pr.title}`} title="Hide pull request"><Icon name="close" size={13} /></button></div>
}

function GitHubRepositorySummary({ repository }) {
  return <a className="github-repository-summary" href={`https://github.com/${repository.name}/pulls`} target="_blank" rel="noreferrer"><Icon name="pullRequest" size={15} className="github-pr-icon accent-text" /><span><strong>{repository.name}</strong><small>{repository.pullRequests.length} open PRs &#8226; showing repository instead</small></span><Icon name="arrowUpRight" size={13} className="github-external" /></a>
}
