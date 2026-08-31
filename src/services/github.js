async function githubJson(url, token, signal) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal });
  if (response.ok) return response.json();
  if (response.status === 401)
    throw new Error("GitHub rejected the token. Check it and try again.");
  if (response.status === 403)
    throw new Error(
      "GitHub rate limit reached. Add a token or try again later.",
    );
  if (response.status === 404)
    throw new Error(
      "GitHub could not access one of these repositories. Check the token permissions.",
    );
  throw new Error(`GitHub returned ${response.status}.`);
}
async function githubPages(url, token, signal) {
  const results = [];
  for (let page = 1; page <= 10; page += 1) {
    const items = await githubJson(
      `${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      token,
      signal,
    );
    if (!Array.isArray(items)) return results;
    results.push(...items);
    if (items.length < 100) break;
  }
  return results;
}
function normalizePullRequest(item, username, fallbackRepo = "") {
  const repo =
    fallbackRepo ||
    item.repository_url?.replace("https://api.github.com/repos/", "") ||
    item.base?.repo?.full_name ||
    "unknown/repository";
  return {
    id: `${repo}#${item.number}`,
    number: item.number,
    repo,
    title: item.title,
    author: item.user?.login || "unknown",
    branch: item.head?.ref || "",
    url: item.html_url,
    updatedAt: item.updated_at,
    draft: Boolean(item.draft),
    isMine: item.user?.login?.toLowerCase() === username.toLowerCase(),
  };
}
export async function loadGitHubPullRequests(username, token, signal) {
  const mine = (
    await githubPages(
      `https://api.github.com/search/issues?q=${encodeURIComponent(`is:pr is:open author:${username}`)}&sort=updated&order=desc`,
      token,
      signal,
    )
  ).map((item) => normalizePullRequest(item, username));
  const repos = await githubPages(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc`,
    token,
    signal,
  );
  const repositories = [];
  for (const repo of repos
    .filter(
      (item) => item.owner?.login?.toLowerCase() === username.toLowerCase(),
    )
    .map((item) => item.full_name)
    .filter(Boolean)) {
    const pullRequests = (
      await githubPages(
        `https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&direction=desc`,
        token,
        signal,
      )
    ).map((item) => normalizePullRequest(item, username, repo));
    if (pullRequests.length) repositories.push({ name: repo, pullRequests });
  }
  return { mine, repositories };
}
