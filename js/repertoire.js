(() => {
      const list = document.getElementById("repertoire-list");
      const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
      }[c]));

      fetch("spotify/playlist.json?v=1")
        .then(response => {
          if (!response.ok) throw new Error("De repertoirelijst kon niet worden geladen.");
          return response.json();
        })
        .then(data => {
          const tracks = data.tracks || [];

          if (!tracks.length) {
            list.innerHTML = '<div class="repertoire-message">Geen nummers beschikbaar.</div>';
            return;
          }

          list.innerHTML = tracks.map((track, index) => {
            const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "";
            const image = track.image
              ? '<img class="repertoire-art" src="' + esc(track.image) + '" alt="" loading="lazy">'
              : '<div class="repertoire-art"></div>';

            return '<article class="repertoire-track" role="link" tabindex="0" data-url="' + esc(track.url || "") + '">' +
              '<div class="repertoire-number">' + String(index + 1).padStart(2, "0") + '</div>' +
              image +
              '<div>' +
                '<p class="repertoire-title">' + esc(track.title) + '</p>' +
                '<p class="repertoire-artist">' + esc(artists) + '</p>' +
              '</div>' +
            '</article>';
          }).join("");

          list.querySelectorAll(".repertoire-track").forEach(track => {
            const openSpotify = () => {
              const url = track.dataset.url;
              if (url) window.open(url, "_blank", "noopener");
            };

            track.addEventListener("click", openSpotify);
            track.addEventListener("keydown", event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openSpotify();
              }
            });
          });
        })
        .catch(error => {
          list.innerHTML = '<div class="repertoire-message">' + esc(error.message) + '</div>';
        });
    })();
