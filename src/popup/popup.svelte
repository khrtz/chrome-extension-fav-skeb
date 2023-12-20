<script lang="ts">
  import { onMount } from 'svelte';
  import { currentPage, favorites, filteredFavorites, totalPages } from '../store';

  const PAGE_SIZE = 10;
  let hosts: Set<string> = new Set();
  let currentFilter: string | null = null;
  let existingItemHighlighted: string | null = null;

  onMount(async () => {
    const result = await chrome.storage.local.get('urlFavorites');
    if (result.urlFavorites) {
      favorites.set(result.urlFavorites);
      updateHosts(result.urlFavorites);
    }
  });

  $: {
    const fav = $favorites;
    const newFilteredFavorites = currentFilter
      ? fav.filter(f => new URL(f.url).hostname === currentFilter)
      : fav;
    filteredFavorites.set(newFilteredFavorites);
    totalPages.set(Math.ceil(newFilteredFavorites.length / PAGE_SIZE));
    updateHosts(fav);
  }

  function updateHosts(fav: Favorite[]) {
    const hostCounts = new Map<string, number>();
    fav.forEach(favorite => {
      let host = new URL(favorite.url).hostname;
      hostCounts.set(host, (hostCounts.get(host) || 0) + 1);
    });
    hosts = new Set(Array.from(hostCounts).filter(([_, count]) => count >= 3).map(([host]) => host));
  }

  function filterByHost(host: string | null) {
    currentFilter = host;
    currentPage.set(1);
  }

  function changePage(page: number) {
    currentPage.set(page);
  }

  function normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  async function addFavorite() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const tab = tabs[0];
    if (!tab.title || !tab.url) return;

    const newFavoriteUrl = normalizeUrl(tab.url);
    const newFavorite = { title: tab.title, url: newFavoriteUrl };

    const existingFavorite = $favorites.find(favorite => normalizeUrl(favorite.url) === newFavoriteUrl);
    if (existingFavorite) {
      existingItemHighlighted = existingFavorite.url;
      currentFilter = null;
      
      const pageIndex = Math.floor($favorites.indexOf(existingFavorite) / PAGE_SIZE);
      currentPage.set(pageIndex + 1);

      setTimeout(() => {
        const element = document.getElementById("item-" + existingFavorite.url);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      setTimeout(() => existingItemHighlighted = null, 2000);
      return;
    }

    const updatedFavorites = [newFavorite, ...$favorites];
    favorites.set(updatedFavorites);

    await chrome.storage.local.set({ urlFavorites: updatedFavorites });

    updateHosts(updatedFavorites);
  }

  async function deleteFavorite(url: string) {
    const updatedFavorites = $favorites.filter(favorite => favorite.url !== url);
    favorites.set(updatedFavorites);
    await chrome.storage.local.set({ urlFavorites: updatedFavorites });
  }

  async function clearFavorites() {
    favorites.set([]);
    await chrome.storage.local.remove('urlFavorites');
  }

  async function openAllFavorites() {
    for (const favorite of [...$favorites]) {
      window.open(favorite.url, '_blank');
    }
  }

  
  function generateColor(host: string): string {  
    const normalizedHost = host.replace(/^(www\.)?/, '');

    const predefinedColors = {
      'pixiv.net': '#0096fa',
      'youtube.com': '#c00',
      'x.com': 'black',
      'twitter.com': 'black'
    };

    if (predefinedColors[normalizedHost as keyof typeof predefinedColors]) {
      return predefinedColors[normalizedHost as keyof typeof predefinedColors];
    }

    let hash = 0;
    for (let i = 0; i < normalizedHost.length; i++) {
      hash = normalizedHost.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = '#' + ((hash & 0xffffff) >>> 0).toString(16).padEnd(6, '0');
    return color;
  }

  function textColorForBackground(backgroundColor: string): string {
    // 背景色のRGB値を取得
    const color = (backgroundColor.charAt(0) === '#') ? backgroundColor.substring(1, 7) : backgroundColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // YIQ色空間に基づく明るさの計算
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
  }

  $: paginatedFavorites = $filteredFavorites.slice(($currentPage - 1) * PAGE_SIZE, $currentPage * PAGE_SIZE);
</script>

<style>
  :global(body) {
    font-family: 'Arial', sans-serif;
    background-color: #f8f9fa;
    color: #212529;
    line-height: 1.5;
    padding: 10px;
  }

  .container {
    max-width: 340px;
    min-width: 340px;
    margin: 0 auto;
    padding: 10px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  .button-container {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .button {
    background-color: #007bff;
    color: white;
    padding: 6px 10px;
    border: 2px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    text-align: center;
    transition: background-color 0.3s, border-color 0.3s;
    margin: 5px;
  }

  .button:focus {
    background-color: #0056b3;
    border-color: #0056b3;
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
  }

  .button:hover {
    background-color: #0056b3;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 20px;
  }

  .tag {
    background-color: #e9ecef;
    border: 1px solid #dee2e6;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    margin: 2px;
    font-size: 14px;
  }

  .tag:focus,
  .tag:hover {
    background-color: #dae0e5;
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #dee2e6;
    border-radius: 5px;
  }

  .tag-marker {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
    flex-shrink: 0;
  }

  li {
    display: flex;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #dee2e6;
  }

  li a {
    flex-grow: 1;
    margin-right: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  li:last-child {
    border-bottom: none;
  }

  a {
    color: #007bff;
    text-decoration: none;
    font-weight: bold;
  }

  a:focus,
  a:hover {
    text-decoration: underline;
    outline: 3px solid #1372e6;
    outline-offset: 2px;
  }

  .deleteButton {
    flex-shrink: 0;
    width: 50px;
    background-color: #f95161;
    color: white;
    border: 2px solid transparent;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }

  .deleteButton:focus,
  .deleteButton:hover {
    background-color: #b31b2a;
    border-color: #b31b2a;
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }

  .page-button {
    margin: 0 5px;
    padding: 5px 10px;
    background-color: #e9ecef;
    border: 1px solid #dee2e6;
    border-radius: 3px;
    cursor: pointer;
  }

  .page-button:hover, .page-button.active {
    background-color: #dae0e5;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgb(37, 150, 255); }
    50% { box-shadow: 0 0 15px rgb(37, 150, 255); }
  }

  .blink-item {
    position: relative;
    z-index: 1;
    animation: glow 2s ease infinite;
    padding: 10px;
    margin: -10px;
  }

</style>

<div class="container">
  <div class="button-container">
    <button class="button" on:click={addFavorite}>Favorite</button>
    <button class="button" on:click={openAllFavorites}>All Open</button>
    <button class="button" on:click={clearFavorites}>All Clear</button>
  </div>  

  <div class="tags">
    <button class="tag" on:click={() => filterByHost(null)}>すべて</button>
    {#if Array.from(hosts).length > 0}
      {#each Array.from(hosts) as host}
        <button class="tag"
                style="background-color: {generateColor(host)}; color: {textColorForBackground(generateColor(host))};"
                on:click={() => filterByHost(host)}>
          {host}
        </button>
      {/each}
    {/if}
  </div>

  <ul>
    {#each paginatedFavorites as favorite (favorite.url)}
    <li id={"item-" + favorite.url} class:blink-item={favorite.url === existingItemHighlighted}>
      <span class="tag-marker" style="background-color: {generateColor(new URL(favorite.url).hostname)};"></span>
      <a href={favorite.url} target="_blank" rel="noopener noreferrer">{favorite.title}</a>
      <button class="deleteButton" on:click={() => deleteFavorite(favorite.url)}>削除</button>
    </li>
    {/each}
  </ul>

  <div class="pagination">
    {#each Array.from({length: $totalPages}, (_, i) => i + 1) as page}
      <button 
        class="page-button {page === $currentPage ? 'active' : ''}"
        on:click={() => changePage(Number(page))}
        disabled={$totalPages === 1}>
        {page}
      </button>
    {/each}
  </div>
</div>
