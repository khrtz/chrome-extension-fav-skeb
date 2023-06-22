document.addEventListener('DOMContentLoaded', function() {
  const favoriteButton = document.getElementById('favoriteButton');
  const favoriteList = document.getElementById('favoriteList');
  const openfavoriteAll = document.getElementById("openfavoriteAll")

  const clearFavoritesButton = document.getElementById('clearFavoritesButton');
  clearFavoritesButton.addEventListener('click', function() {
    chrome.storage.local.remove('skebWorkFavorites', function() {
      favoriteList.innerHTML = '';
    });
  });

  // お気に入り一覧を取得する
  chrome.storage.local.get('skebWorkFavorites', function(result) {
    if (result.skebWorkFavorites) {
      // お気に入り一覧を表示する
      for (const favorite of result.skebWorkFavorites) {
        const li = document.createElement('li');
        const titleLink = document.createElement('a');
        titleLink.textContent = favorite.title;
        titleLink.href = favorite.url;
        titleLink.target = '_blank';
        li.appendChild(titleLink);

        // 削除ボタンを追加する
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('deleteButton');

        deleteButton.addEventListener('click', function() {
          chrome.storage.local.get('skebWorkFavorites', function(result) {
            let favorites = [];
            if (result.skebWorkFavorites) {
              favorites = result.skebWorkFavorites;
            }

            // 削除する項目を配列から削除する
            favorites = favorites.filter(function(favoriteItem) {
              return favoriteItem.url !== favorite.url;
            });

            // ストレージを更新する
            chrome.storage.local.set({ skebWorkFavorites: favorites }, function() {
              // お気に入り一覧を更新する
              favoriteList.innerHTML = '';
              for (const favorite of favorites) {
                const li = document.createElement('li');
                const titleLink = document.createElement('a');
                titleLink.textContent = favorite.title;
                titleLink.href = favorite.url;
                titleLink.target = '_blank';
                li.appendChild(titleLink);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = '削除';
                deleteButton.addEventListener('click', function() {
                  // 削除処理をここに書く
                });
                li.appendChild(deleteButton);

                favoriteList.appendChild(li);
              }
            });
          });
        });
        li.appendChild(deleteButton);

        favoriteList.appendChild(li);
      }
    }
  });
  openfavoriteAll.addEventListener('click', function() {
    chrome.storage.local.get('skebWorkFavorites', function(result) {
      if (result.skebWorkFavorites) {
        result.skebWorkFavorites.forEach(function(favorite) {
          window.open(favorite.url, '_blank');
        });
      }
    });
    
  });
  // お気に入りボタンをクリックしたときの処理
  favoriteButton.addEventListener('click', function() {
    // 現在アクティブなタブの情報を取得する
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tab = tabs[0];
      const title = tab.title;
      const url = tab.url;
      // 対象外のドメインの場合は何もしない
      if (!url.startsWith('https://skeb.jp')) {
        return;
      }


      // お気に入り一覧を取得する
      chrome.storage.local.get('skebWorkFavorites', function(result) {
        let favorites = [];
        if (result.skebWorkFavorites) {
          favorites = result.skebWorkFavorites;
        }

        // 既にお気に入りに登録されている場合は何もしない
        if (favorites.some(function(favorite) {
          const id = favorite.url.match(/(\d+)\.html/);
          const currentId = url.match(/(\d+)\.html/);
          return id && currentId && id[1] === currentId[1];
        })) {
          return;
        }

        // お気に入りに追加する
        favorites.push({ title: title, url: url });
        chrome.storage.local.set({ skebWorkFavorites: favorites }, function() {
          // お気に入り一覧を更新する
          const li = document.createElement('li');
          const titleLink = document.createElement('a');
          titleLink.textContent = title;
          titleLink.href = url;
          titleLink.target = '_blank';
          li.appendChild(titleLink);
        
          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'x';
          deleteButton.classList.add('deleteButton');
          deleteButton.addEventListener('click', function(event) {
            const index = favorites.findIndex(function(favorite) { return favorite.url === url; });
            if (index !== -1) {
              favorites.splice(index, 1);
              chrome.storage.local.set({ skebWorkFavorites: favorites }, function() {
                li.remove();
              });
            }
          });
          li.appendChild(deleteButton);
        
          favoriteList.appendChild(li);
        });
      });
    });
  });
});