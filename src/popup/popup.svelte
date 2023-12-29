<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentPage, favorites, filteredFavorites, totalPages, speedDials } from '../store';
  let modal: HTMLElement | null;
  let previousActiveElement: HTMLElement | null;

  const PAGE_SIZE = 10;
  let hosts: Set<string> = new Set();
  let currentFilter: string | null = null;
  let existingItemHighlighted: string | null = null;
  let newItemAdded: string | null = null;
  let importText = '';
  let showImport = false;
  let showModal = false;
  let paginationArray: number[] = [];

  $: paginationArray = Array.from({length: $totalPages}, (_, i) => i + 1);
  
  let darkMode = localStorage.getItem('darkMode') === 'true';

  function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', String(darkMode));
  }

  async function clearFavorites() {
    showModal = true;
  }

  async function confirmClear() {
    favorites.set([]);
    await chrome.storage.local.set({ urlFavorites: [] });
    showModal = false;
  }

  function cancelClear() {
    showModal = false;
  }

  function showImportInput() {
    showImport = true;
  }

  onMount(async () => {
    previousActiveElement = document.activeElement as HTMLElement | null;
    if (modal) {
      modal.focus();
    }
    const result = await chrome.storage.local.get('urlFavorites');
    if (result.urlFavorites) {
      favorites.set(result.urlFavorites);
      updateHosts(result.urlFavorites);
    }
    const storedSpeedDials = JSON.parse(localStorage.getItem('speedDials') || '[]');
    speedDials.set(storedSpeedDials);
  });

  onDestroy(() => {
    if (previousActiveElement) {
      previousActiveElement.focus();
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

    const elements = document.querySelectorAll('.container, body');
    elements.forEach(element => {
      if (darkMode) {
        element.classList.add('dark-mode');
      } else {
        element.classList.remove('dark-mode');
      }
    });
    const { start, end } = getPaginationRange($currentPage, $totalPages);
    paginationArray = [];
    for (let i = start; i <= end; i++) {
      paginationArray.push(i);
    }
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
    newItemAdded = newFavorite.url;
    setTimeout(() => newItemAdded = null, 2000);
  }

  async function deleteFavorite(url: string) {
    const updatedFavorites = $favorites.filter(favorite => favorite.url !== url);
    favorites.set(updatedFavorites);
    await chrome.storage.local.set({ urlFavorites: updatedFavorites });
  }

  async function openAllFavorites() {
    const currentFavorites = $favorites;
    for (let favorite of currentFavorites) {
      chrome.tabs.create({ url: favorite.url, active: false });
    }
  }

  async function exportLinks() {
    const urls = $favorites.map(favorite => `<a href="${favorite.url}" target="_blank">${favorite.url}</a>`).join('<br>');
    const blob = new Blob([urls], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function importFavorites() {
    const urlArray = importText.split('\n').filter(url => url.trim() !== '' && isValidURL(url));
    let newFavorites = [];

    for (const url of urlArray) {
      const title = await fetchTitle(url);
      if (typeof title === 'string') {
        newFavorites.push({ url, title });
      } else {
        console.error(`Failed to fetch title for url ${url}`);
      }
    }

    const updatedFavorites = [...newFavorites, ...$favorites];

    favorites.set(updatedFavorites);
    await chrome.storage.local.set({ urlFavorites: updatedFavorites });
    showImport = false;
    importText = '';
}

async function addSpeedDial() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;

  const tab = tabs[0];
  if (!tab.url) return;

  const newDial: SpeedDial = { url: tab.url, favicon: tab.favIconUrl };

  speedDials.update(currentDials => {
    const updatedDials = [...currentDials, newDial];
    localStorage.setItem('speedDials', JSON.stringify(updatedDials));
    return updatedDials;
  });
}

function deleteSpeedDial(url: string) {
  speedDials.update(currentDials => {
    const updatedDials = currentDials.filter(dial => dial.url !== url);
    localStorage.setItem('speedDials', JSON.stringify(updatedDials));
    return updatedDials;
  });
}

function openLink(url: string) {
  chrome.tabs.create({ url: url });
}


async function fetchTitle(url: string) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({ url, active: false }, tab => {
            const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
                if (info.status === 'complete' && tabId === tab.id) {
                    setTimeout(() => {
                        chrome.tabs.get(tabId, updatedTab => {
                            if (updatedTab.title) {
                                resolve(updatedTab.title);
                            } else {
                                reject(new Error(`Failed to fetch title for ${url}`));
                            }
                            chrome.tabs.remove(tabId);
                            chrome.tabs.onUpdated.removeListener(listener);
                        });
                    }, 1500);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    });
}

  function isValidURL(url: string) {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;  
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

  async function importOpenTabs() {
    chrome.tabs.query({}, async (tabs) => {
      const newFavorites = tabs.map(tab => ({ url: tab.url, title: tab.title }));
      const currentFavorites = $favorites;
      let updatedFavorites: Favorite[] = [...currentFavorites, ...(newFavorites as Favorite[])];
      favorites.set(updatedFavorites);
      await chrome.storage.local.set({ urlFavorites: updatedFavorites });
    });
  }

  function getPaginationRange(current: number, total: number) {
    const range = 2; // 現在のページの前後に表示するページ数
    let start = Math.max(1, current - range);
    let end = Math.min(total, current + range);

    // 表示するページ数が5未満の場合の調整
    const maxPagesToShow = 5;
    const numOfPages = end - start + 1;
    if (numOfPages < maxPagesToShow) {
      if (start > 1) {
        start = Math.max(1, start - (maxPagesToShow - numOfPages));
      }
      if (end < total) {
        end = Math.min(total, end + (maxPagesToShow - numOfPages));
      }
    }

    return { start, end };
  }

  $: paginatedFavorites = $filteredFavorites.slice(($currentPage - 1) * PAGE_SIZE, $currentPage * PAGE_SIZE);
</script>

<style>
  :global(body.dark-mode) {
    background-color: #525252;
    color: #ccc;
  }

  :global(.container.dark-mode) {
    background-color: #1f1f1f;
    color: #fff;
  }

  :global(body.dark-mode) a {
      color: #a3daff;
  }

  :global(body.dark-mode) .button {
      background-color: #007bff;
      color: #fff;
      border-color: #0056b3;
  }

  :global(body.dark-mode) a:focus {
    background-color: #333;
  }

  :global(body.dark-mode) a:hover {
    background-color: #5a5858;
  }

  :global(body.dark-mode) .deleteButton {
      background-color: #f95161;
      color: #fff;
      border-color: #b31b2a;
  }

  :global(body.dark-mode) .tag {
      background-color: #555;
      color: #ccc;
      border-color: #444;
  }
</style>

<div class="container">
  {#if showModal}
      <div
      class="modal"
      role="dialog"
      bind:this={modal}
    >
      <p id="modalDescription">お気に入りをすべて削除しますか？</p>
      <button on:click={confirmClear}>はい</button>
      <button on:click={cancelClear}>いいえ</button>
    </div>
  {/if}

  <div>
     <button class="icon-button" on:click={toggleDarkMode}>
    <i class="fas fa-lightbulb" style="color: {darkMode ? 'yellow' : 'gray'};"></i>
  </button>
  </div>

  <div class="speed-dial-grid">
    {#each $speedDials as dial}
      <button class="speed-dial-item" type="button" on:click={() => openLink(dial.url)}>
        <img src={dial.favicon || 'default-icon.png'} class="speed-dial-icon" alt="スピードダイヤル" />
        <button class="delete-dial-button" on:click={e => { e.stopPropagation(); deleteSpeedDial(dial.url); }} aria-label="削除">×</button>
      </button>
    {/each}
  </div>

  
  <div class="button-container">
    <button class="button" on:click={addFavorite}>お気に入り追加</button>
    <!-- <button class="button" on:click={openAllFavorites}>すべて開く</button> -->
    <!-- <button class="button" on:click={importOpenTabs}>開いているタブをすべて登録</button> -->
    <button class="button" on:click={exportLinks}>エクスポート</button>
    <button class="button" on:click={addSpeedDial}>スピードダイヤル追加</button>
    {#if showImport}
      <label for="importTextArea">URLs:</label>
      <textarea id="importTextArea" bind:value={importText} placeholder="コピペしたURLを入力"></textarea>
      <button  class="button" on:click={importFavorites}>インポート実行</button>
    {:else}
      <button class="button" on:click={showImportInput}>URLインポート</button>
    {/if}

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
      <li id={"item-" + favorite.url}
          class:blink-item={favorite.url === existingItemHighlighted}
          class:new-item={newItemAdded === favorite.url}>
        <span class="tag-marker" style="background-color: {generateColor(new URL(favorite.url).hostname)};"></span>
        <a href={favorite.url} target="_blank" rel="noopener noreferrer">{favorite.title}</a>
        <button class="deleteButton" on:click={() => deleteFavorite(favorite.url)}>削除</button>
      </li>
    {/each}
  </ul>

  <div class="pagination">
    {#if $totalPages > 1}
      {#if $currentPage > 1}
        <button class="page-button" on:click={() => changePage($currentPage - 1)}>&laquo;</button>
      {/if}
  
      {#each paginationArray as page}
        <button 
          class="page-button {page === $currentPage ? 'active' : ''}"
          on:click={() => changePage(Number(page))}
        >
          {page}
        </button>
      {/each}
  
      {#if $currentPage < $totalPages}
        <button class="page-button" on:click={() => changePage($currentPage + 1)}>&raquo;</button>
      {/if}
    {/if}
  </div>
</div>
