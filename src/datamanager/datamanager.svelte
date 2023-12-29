<script lang="ts">
    import { favorites, speedDials } from '../store';

    export let importText = '';
    let showImport = false;

    async function exportData() {
        const favoritesResult = await chrome.storage.local.get('urlFavorites');
        const speedDialsResult = await chrome.storage.local.get('speedDials');

        console.log('Favorites:', favoritesResult);
        console.log('Speed Dials:', speedDialsResult);

        const dataToExport = {
            urlFavorites: favoritesResult.urlFavorites || [],
            speedDials: speedDialsResult.speedDials || []
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'backup.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function handleFileUpload(event: Event) {
        const file = (event.target as HTMLInputElement)?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = (e.target as FileReader).result;
                try {
                    const data = JSON.parse(content as string);
                    if (data.urlFavorites && data.speedDials) {
                        // 重複チェックと追加処理
                        const existingFavorites = $favorites;
                        const existingSpeedDials = $speedDials;
                        const newFavorites = data.urlFavorites.filter((item: Favorite) => !existingFavorites.some(fav => fav.url === item.url));
                        const newSpeedDials = data.speedDials.filter((dial: Favorite) => !existingSpeedDials.some(sd => sd.url === dial.url));

                        const updatedFavorites = [...newFavorites, ...existingFavorites];
                        const updatedSpeedDials = [...newSpeedDials, ...existingSpeedDials];

                        await chrome.storage.local.set({ urlFavorites: updatedFavorites });
                        await chrome.storage.local.set({ speedDials: updatedSpeedDials });

                        favorites.set(updatedFavorites);
                        speedDials.set(updatedSpeedDials);
                    } else {
                        console.error('Invalid backup file');
                    }
                } catch (error) {
                    console.error('Error reading file:', error);
                }
            };
            reader.readAsText(file);
        }
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

    function showImportInput() {
        showImport = true;
    }
</script>

<div>
    {#if showImport}
        <label for="importTextArea">URLs:</label>
        <textarea id="importTextArea" bind:value={importText} placeholder="コピペしたURLを入力"></textarea>
        <button class="button" on:click={importFavorites}>インポート実行</button>
    {:else}
        <button class="button" on:click={showImportInput}>URLインポート</button>
    {/if}
    <button class="button" on:click={exportData}>JSONをエクスポート</button>

    <div class="file-upload-container">
        <label for="fileInput" class="file-input-label">
            JSONファイルを選択してインポート
        </label>
        <input type="file" id="fileInput" accept=".json" on:change={handleFileUpload} aria-describedby="fileHelp" />
        <span id="fileHelp" class="help-text">
            JSON形式のバックアップファイルを選択してください。
        </span>
    </div>
</div>