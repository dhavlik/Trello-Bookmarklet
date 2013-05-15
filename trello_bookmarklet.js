(function(window){
  var $;

    var notify = function(card) {
        // Display a little notification in the upper-left corner with a link to the card
        // that was just created
        var container = $('#cardcontainer');
        if (!container.length) {
            $('<div id="cardcontainer"></div>').css({
                  position: "absolute",
                  left: 0,
                  "z-index": 1e4,
                  top: 0}).appendTo("body");
            var container = $('#cardcontainer');
        }
        var $cardLink = $("<a>")
        .attr({
          href: card.url,
          target: "card"
        })
        .text("Created trello card '" + card.name + "'")
        .css({
          padding: "4px",
          border: "1px solid #000",
          background: "#fff",
          "z-index": 1e4
        })
        .appendTo("#cardcontainer")

        setTimeout(function(){
          $cardLink.fadeOut(3000);
        }, 5000)
    }

  /* This is run after we've connected to Trello and selected a list */
  var run = function(Trello, idList) {
    var name;
    var tickets;
    // Default description is the URL of the page we're looking at
    var desc = location.href;

    if(window.goBug) {

      // We're looking at a FogBugz case
      name = goBug.ixBug + ": " + goBug.sTitle

    } else if ($("#issue_header_summary").length){

      // We're looking at a JIRA case in an older JIRA installation
      name = $("#key-val").text() + ": " + $("#issue_header_summary").text();

    } else if ($("#jira").length){

      // We're looking at a 5.1+ JIRA case
      name = $("#key-val").text() + ": " + $("#summary-val").text();

    } else if ($("#show_issue").length) {

      // We're looking at a GitHub issue
      name = $("#show_issue .number strong").text() + " " + $("#show_issue .discussion-topic-title").text();

    } else if ($("#all_commit_comments").length) {

      // We're looking at a GitHub commit
      name = $(".js-current-repository").text().trim() + ": " + $(".commit .commit-title").text().trim();
      
    } else if (jQuery('head meta[content=Redmine]').length) {
      
      // We're looking at a redmine issue
      name = $("#content h2:first").text().trim() + ": " + $("#content h3:first").text().trim();
    } else if ($('a#page-edit_search').length) {
        // We're looking at a RequestTracker (RT) search result
        base_url = window.location.href.split('/').splice(0,3).join('/');
        tickets = {};
        all_tickets = $('td.collection-as-table b a');
        // we need to find out the column where the owner is
        $('th.collection-as-table a').each(function(index, header) {
            header_link = $(header).attr('href');
            if (header_link.indexOf('OrderBy=Owner') != -1) {
                owner_index = index;
            } else if (header_link.indexOf('OrderBy=Status') != -1) {
                status_index = index;
            }
        });
        // we now have all links twice, from column 1 and 2. 
        $.each(all_tickets, function(ind, ticket) {
            ticket = $(ticket);
            if (ticket.attr('href').indexOf(ticket.text()) == -1) {
                cells = ticket.parents('tr').find('td');
                owner = $(cells[owner_index]).text();
                stat = $(cells[status_index]).text();
                if (owner != 'Nobody' & ((stat == 'open') | (stat == 'offen'))) {
                    if (!(owner in tickets)) {
                        tickets[owner] = {user: owner, tickets: []};
                    }
                    tickets[owner].tickets.push(
                        {url: base_url + ticket.attr('href'),
                         descr: ticket.text()});
                }
            }
        });
    } else if ($('#header h1').length) {

        // We're looking at a RequestTracker (RT) ticket
        name = $('#header h1').text().trim();

    } else if ($('h1 .hP').length){
        
        // we're looking at an email in Gmail
        name = $('h1 .hP').text().trim();
    
    }
    
    else {
        // use page title as card title, taking trello as a "read-later" tool
        name = $.trim(document.title);
        
    }

    // Get any selected text
    var selection;

    if(window.getSelection) {
      selection = ""+window.getSelection();
    } else if(document.selection && document.selection.createRange) {
      selection = document.selection.createRange().text;
    }

    // If they've selected text, add it to the name/desc of the card
    if(selection) {
      if(!name) {
        name = selection;
      } else {
        desc += "\n\n" + selection;
      }
    }
    
    name = name || 'Unknown page';

    if (tickets) {
        // Create a bunch of cards
        created = 0;
        $.each(tickets, function(t_index, usertickets) {
            if (usertickets.tickets.length > 0) {
                Trello.post("lists/" + idList + "/cards", {
                    name: 'RT Tickets for ' + usertickets.user,
                    desc: desc
                }, function(card) {
                    // Add checklist
                    Trello.post("cards/" + card.id + "/checklists", {
                        name: 'TODO'
                    }, function(checklist) {
                       // Add items
                       notify(card);
                       $.each(usertickets.tickets, function(idx, tick) {
                           Trello.post("checklists/" + checklist.id + '/checkItems', {
                                name: tick.descr + ' (' + tick.url + ')'
                           });
                       });
                    });
                });
            }
        });
    } else if(name) {
      //create a single card
      Trello.post("lists/" + idList + "/cards", { 
        name: name, 
        desc: desc
      }, function(card){
          notify(card);
      })
    }
  }

  var storage = window.localStorage;
  if(!storage) {
    return;
  }

  // Store/retrieve a value from local storage
  var store = function(key, value){
    if(arguments.length == 2){
      return (storage[key] = value);
    } else {
      return storage[key];
    }
  };

  // A fake "prompt" to get info from the user
  var overlayPrompt = function(html, hasInput, callback){
    var done = function(value){
      $div.remove();
      $overlay.remove();
      callback(value);
    };

    // Cover the existing webpage with an overlay
    var $overlay = $("<div>")
    .css({
      background: "#000",
      opacity: .75,
      "z-index": 1e4,
      position: "absolute",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    })
    .appendTo("body")
    .click(function(){
      done(null);
    })

    // Show a "popup"
    var $div = $("<div>")
    .css({
      position: "absolute",
      border: "1px solid #000",
      padding: "16px",
      width: 300,
      top: 64,
      left: ($(window).width() - 200) / 2,
      background: "#fff",
      "z-index": 1e5
    })
    .appendTo("body");

    // Show the prompt
    $("<div>").html(html).appendTo($div);

    // Optionally show an input
    var $input = $("<input>")
    .css({ 
      width: "100%",
      "margin-top": "8px"
    })
    .appendTo($div)
    .toggle(hasInput);

    // Add an "OK" button
    $("<div>")
    .text("OK")
    .css({ 
      width: "100%", 
      "text-align": "center",
      border: "1px solid #000",
      background: "#eee",
      "margin-top": "8px",
      cursor: "pointer"
    })
    .appendTo($div)
    .click(function(){
      done($input.val());      
    });

    return $div;
  };

  // Run several asyncronous functions in order
  var waterfall = function(fxs){
    var runNext = function(){
      if(fxs.length){
        fxs.shift().apply(null, Array.prototype.slice.call(arguments).concat([runNext]))
      }
    }
    runNext();
  }

  // The ids of values we keep in localStorage
  var appKeyName = "trelloAppKey";
  var idListName = "trelloIdList";

  waterfall([
    // Load jQuery
    function(next) {
      if(window.jQuery) {
        next(null);
      } else {
        var script = document.createElement("script");
        script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js";
        script.onload = next;
        document.getElementsByTagName("head")[0].appendChild(script);
      }
    },
    // Get the user's App Key, either from local storage, or by prompting them to retrieve it
    function(ev, next) {
      $ = window.jQuery;

      var appKey = store(appKeyName) || window[appKeyName];
      if(appKey && appKey.length == 32) {
        next(appKey);
      }
      else {
        overlayPrompt("Please specify your Trello API Key (you'll only need to do this once per site)<br><br>You can get your API Key <a href='https://trello.com/1/appKey/generate' target='apikey'>here</a><br><br>", true, function(newAppKey){
          if(newAppKey) {
            next(newAppKey);
          }
        })
      }
    },
    // Load the Trello script
    function(appKey, next) { $.getScript("https://trello.com/1/client.js?key=" + appKey, next); },
    // Authorize our application
    function(a, b, c, next) {
      store(appKeyName, Trello.key())
      Trello.authorize({
        interactive: false,
        success: next,
        error: function(){
          overlayPrompt("You need to authorize Trello", false, function(){
            Trello.authorize({
              type: "popup",
              expiration: "never",
              scope: { read: true, write: true },
              success: next
            });
          });
        }
      });
    },
    // Get the list to add cards to, either from local storage or by prompting the user
    function(next) {
      var idList = store(idListName) || window[idListName];
      if(idList && idList.length == 24) {
        next(idList);
      } else {
        Trello.get("members/me/boards", { fields: "name" }, function(boards){
          $prompt = overlayPrompt('Which list should cards be sent to?<hr><div class="boards"></div>', false, function(){
            idList = $prompt.find("input:checked").attr("id");
            next(idList);
          })

          $.each(boards, function(ix, board){
            $board = $("<div>").appendTo($prompt.find(".boards"))

            Trello.get("boards/" + board.id + "/lists", function(lists){
              $.each(lists, function(ix, list) {
                var $div = $("<div>").appendTo($board);
                idList = list.id;
                $("<input type='radio'>").attr("id", idList).attr("name", "idList").appendTo($div);
                $("<label>").text(board.name + " : " + list.name).attr("for", idList).appendTo($div);
              });
            })
          });
        });
      }      
    },
    // Store the idList for later
    function(idList, next) {
      if(idList) {
        store(idListName, idList);
        next(Trello, idList);
      }      
    },
    // Run the user portion
    run
  ]);
})(window);
