"use strict";

// All the data needed is stored as a placeID that is
// identified by the google maps api as a place with name, cords, and a user
// review
var models = [
    {placeID: 'ChIJKz9HgI7SD4gRuqNPXy7ZZPc'},
    {placeID: 'ChIJDYqWa7kAD4gRzkXAC8pwfZc'},
    {placeID: 'ChIJd-xtKohODogRmAqYF2sMM0Q'},
    {placeID: 'ChIJJ_pwqpmrD4gRNCjSxli0tKI'},
    {placeID: 'ChIJOfCJCxxSDogRy5DfTgM55tY'},
    {placeID: 'ChIJ_WDlqEBWDogRdol0b1ORTck'},
    {placeID: 'ChIJ4-vklcS9D4gRBr-OmscQVTM'},
    {placeID: 'ChIJQdkrHXjLD4gR1NjHUR0RjcY'},
    {placeID: 'ChIJwVd-GZm3D4gRPLBW74-Jtr8'},
    {placeID: 'ChIJvXc6lGslDogRZjQG28shJyE'},
];

// These are global variables needed by the viewmodel, it includes the map and all
// created markers
var map;
var completed_markers = [];

var ViewModel = function () {
    // These variables are needed to keep view updated
    var self = this;
    this.loading = ko.observable();
    this.storenames = ko.observableArray([]);
    this.shopname = ko.observable();
    this.humanaddress = ko.observable();
    this.userreview = ko.observable();
    this.foodplaces = ko.observableArray([]);
    this.button_code = ko.observable();
    this.nearbyPlaces = ko.observable();
    this.userAddress = ko.observable('');
    this.listsearch = ko.observable();
    this.selected_dist = ko.observable();

    // This computed obseravble is used to sort the locations in the sidebar by alphabet
    // and to allow the user to search through the list, while live updating the sidebar.
    this.locationItems = ko.computed(function () {
        return function () {
            // This sorts all the locations by alphabet
            var storetitles = [];
            for (var i = 0; i < self.storenames().length; i++) {
                storetitles.push(self.storenames()[i].title + '|' + String(i));
            }
            var sortedtitles = storetitles.sort();
            var sortedstores = [];
            for (var i = 0; i < sortedtitles.length; i++) {
                var theindex = sortedtitles[i].split('|')[1];
                sortedstores[i] = self.storenames()[theindex];
            }

            // This filters the sidebar list by text the user enters in listsearch
            // It also changes the visibilty of markers. If a location meets the user
            // search terms then it is shown.
            // This uses data from the storenames array.
            var filter = self.listsearch();
            if (filter == null || filter == '') {
                for (var i = 0; i < self.storenames().length; i++) {
                    var vmark = self.storenames()[i].mark;
                    vmark.setVisible(true);
                }
                return sortedstores;
            } else {
                for (var i = 0; i < self.storenames().length; i++) {
                    var themark = self.storenames()[i].mark;
                    themark.setVisible(false);
                }
                var sortedfiltered = sortedtitles.filter(function (item) {
                    var name = item.toLowerCase();
                    return name.includes(filter.toLowerCase());
                });

                var sortedmatch =[];
                for (var i = 0; i < sortedfiltered.length; i++) {
                    var theindex = sortedfiltered[i].split('|')[1];
                    sortedmatch[i] = self.storenames()[theindex];
                }
                for (var i = 0; i < sortedmatch.length; i++) {
                    var vmark = sortedmatch[i].mark;
                    vmark.setVisible(true);
                }
                return sortedmatch;
            }
        };
    }(this.listsearch));

    // This function converts the PlaceIDs into a mark_object object, which contains
    // store names, location etc.
    var placeIDConvert = function() {
        var service = new google.maps.places.PlacesService(map);
        // Google api calls are done in batches of 10, in order to follow api rules of
        // 10 requests per second.
        var chuck = 10;
        for (var i = 0; i < models.length; i+= chuck) {
            var chopped_array = models.slice(i,i+9);
            var full = models.length - 2;
            var currentCount = 1;

            setTimeout(function(chopped_array) {
                self.loading('Loading....');
                return function() {
                for (var i = 0; i < chopped_array.length; i++) {
                    var request = {placeId: chopped_array[i]['placeID']};
                    service.getDetails(request, function (place, status) {
                        if (status === google.maps.places.PlacesServiceStatus.OK) {
                            var checkforreviews = place.reviews;
                            if (checkforreviews == null) {
                                var reviewtext = 'No User Review Available';
                            } else {
                                var reviewtext = place.reviews[0].text;
                            }
                            var lat = JSON.stringify(place.geometry.location.lat());
                            var lng = JSON.stringify(place.geometry.location.lng());

                            // This object is created for both creating markers and
                            // updating the DOM by pushing it to the storenames observable
                            var mark_object = {
                            position: place.geometry.location,
                            title: place.name,
                            address: place.formatted_address,
                            review: reviewtext,
                            animation: google.maps.Animation.DROP,
                            lat: lat,
                            lng: lng
                            };

                            // Markers are sent to this function to be created for the
                            // google map
                            var created_mark = createMarker(mark_object);

                            // This observale array keeps the DOM updated
                            self.storenames.push({
                                title: place.name,
                                address: place.formatted_address,
                                review: reviewtext,
                                distance: '',
                                duration: '',
                                lat: lat,
                                lng: lng,
                                mark: created_mark
                                });
                            } else {
                                console.log(status);
                                window.alert('Could not Find Locations in Database');
                            }

                            // This keeps track of how much of the models has been processed.
                            // Once the entire model is converted, the loading is finished.
                            if (currentCount > full) {
                                self.loading('');
                            } else {
                                currentCount += 1;
                                self.loading('Loading....');
                            }
                        });
                    }
                };
            }(chopped_array), 1000*i);
        }
    }(this.loading, this.storenames);


    // This function stops any bouncing markers on the map
    function stopbounce () {
        for (var i = 0; i < self.storenames().length; i++) {
            var marker = self.storenames()[i].mark;
            marker.setAnimation(null);
        }
    }(this.storenames);

    // This function keeps track of the last opened InfoWindow and closes it when a
    // new one is opened.
    var lastwindow = null;
    function closeinfo(info) {
        if (lastwindow !== null) {
            lastwindow.close();
            lastwindow = null;
        }
        lastwindow = info;
    }

    // This function adds behaviors to the the markers, like causing the marker to bounce when clicked
    // and adding an infowindow to each marker
    function addlistener(mark) {
        mark.addListener('click', function (mark) {
            return function() {
                stopbounce();
                if (mark.getAnimation() !== null) {
                    mark.setAnimation(null);
                } else {
                    var infowindow = new google.maps.InfoWindow({
                        content: '<strong>' + mark.title + '</strong>' + '<br>' + mark.address
                    });
                    closeinfo(infowindow);
                    mark.setAnimation(google.maps.Animation.BOUNCE);
                    infowindow.open(map, mark);
                }
            };
        }(mark));
    }

    // This creates markers on the map and then stores the completed markers
    // in the completed_markers array.
    function createMarker (marker) {
            var mark = new google.maps.Marker({
                map: map,
                position: marker.position,
                title: marker.title,
                address: marker.address,
                review: marker.review,
                animation: google.maps.Animation.DROP,
                lat: marker.lat,
                lng: marker.lng
            });
            addlistener(mark);
            completed_markers.push(mark);
            return mark;
}

    // This function loops through the
    // completed_markers array and extracts Lat Lng data to send to the google
    // distance matrix to find the distance of each store from the user.
    function findclosest () {
        var address = self.userAddress();
        var selected_dist = self.selected_dist();

        if (address !== '') {
            var distanceMS = new google.maps.DistanceMatrixService();
            var dests = [];
            for (var i = 0; i < completed_markers.length; i++) {
                dests.push(completed_markers[i].position);
            }

            distanceMS.getDistanceMatrix({
                origins: dests,
                destinations: [address],
                travelMode: 'DRIVING',
                unitSystem: google.maps.UnitSystem.IMPERIAL,
            }, function (response, status) {
                if (status !== google.maps.DistanceMatrixStatus.OK) {
                    window.alert('ERROR FINDING LOCATION');
                }

                else if (response.rows[0].elements[0].status === 'NOT_FOUND') {
                    window.alert('Location Not Found');
                } else {
                    // The storenames array that keeps the DOM updated, is deleted and
                    // updated with the distance from the user and duration of trip.
                    self.storenames.removeAll();
                    for (var i = 0; i < response.rows.length; i++) {
                        if (parseInt(response.rows[i].elements[0].distance.text.slice(0,2)) <= parseInt(selected_dist)) {

                            self.storenames.push({
                                distance: response.rows[i].elements[0].distance.text,
                                duration: response.rows[i].elements[0].duration.text,
                                title: completed_markers[i].title,
                                address: completed_markers[i].address,
                                review: completed_markers[i].review,
                                lat: completed_markers[i].lat,
                                lng: completed_markers[i].lng,
                                mark: completed_markers[i]});

                            completed_markers[i].setVisible(true);
                            self.button_code('<button type="button" name="button" class="get_directions">Get Directions</button>');
                        } else {
                            completed_markers[i].setVisible(false);
                        }
                    }
                }
            });
        } else {
            window.alert('Please Enter Address');
        }
    }(this.button_code, this.storenames, this.userAddress, this.selected_dist);


    // This function is used to find the entered location in the user address bar,
    // and calls the function to find locations near the user entered address.
    this.userorigin = function () {
        var address = this.userAddress();
        findclosest();
        if (address !== '') {
                var geo = new google.maps.Geocoder();
                geo.geocode( { 'address': address}, function(results, status) {
                  if (status == 'OK') {
                      this.usercords = results[0]['geometry']['location'];
                      map.setCenter(this.usercords);
                  } else {
                    alert('Address Not Valid: ' + status);
                  }
            });
        }
};

    // This function is called when a user clicks the get directions button next to
    // each nearby location. The directionToggle variable is needed to keep track of the
    // last route, so the display can be disabled and new route can be shown.
    var directionToggle = null;
    this.directions = function (location_address) {
        var address = self.userAddress();
        if (address !== '') {
            var directService = new google.maps.DirectionsService;
            if (directionToggle !== null) {
                directionToggle.setMap(null);
                directionToggle = null;
            }
            directService.route({
                origin: address,
                destination: location_address,
                travelMode: 'DRIVING'
            }, function(response, status){
                if (status === google.maps.DirectionsStatus.OK) {
                    var displatDirect = new google.maps.DirectionsRenderer({
                        map: map,
                        directions: response,
                        polylineOptions: {
                            strokeColor: 'black'
                        }
                    });
                directionToggle = displatDirect;
                } else {
                    window.alert('Could not Find Directions: ' + status);
                }
            });
        }
    };

    // This function is called when the user clicks on a location in the sidebar.
    // it calls stopbounce() to stop any bouncing markers, and changes details in the
    // div under the map. It also animated the associated marker
    this.changedetails = function(title, address, review, mark){
        stopbounce();
        this.shopname(title);
        this.humanaddress(address);
        this.userreview(review);
        mark.setAnimation(google.maps.Animation.BOUNCE);
    };

    // This function is called when a user clicks on an item on the right hand list
    // It changes the details in the container under the map, and triggers a marker animation.
    // It also uses the foursquare api to find nearby resturants.
    this.nearbyfoods = function (lat, lng) {
        var urlR = "https://api.foursquare.com/v2/venues/search?ll=" + lat +"%2C" + lng +"&query=food&radius=800&client_id=!!!!CLIENT_ID_HERE&client_secret=!!!!CLIENT_SECRET_HERE&v=20180314";

        setTimeout(function(){
            console.log('RAN');
            $.ajax({
                url: urlR,
                dataType: 'json',
                success: function (data) {
                    self.foodplaces.removeAll();
                    for (var i = 0; i < data.response.venues.length; i++) {
                    self.foodplaces.push({name: data.response.venues[i].name, address: data.response.venues[i].location.formattedAddress});
                    }
                    if (self.foodplaces().length === 0) {
                        self.nearbyPlaces("Could'nt Find Nearby Resturants");
                    } else {
                        self.nearbyPlaces('While you wait. (Provided by FourSquare)');
                    }
                },
                error: function () {
                    self.nearbyPlaces("Problem Getting Nearby Resturants");
                }
            });
        }, 1000);
    };
};

// This is a callback function for the google maps api, it also applies the knockoutjs
// bindings.
function initMap() {
    var map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 41.9414482, lng: -88.1558407},
        zoom: 9,
        styles: [
          {
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#f5f5f5"
              }
            ]
          },
          {
            "elementType": "labels.icon",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#616161"
              }
            ]
          },
          {
            "elementType": "labels.text.stroke",
            "stylers": [
              {
                "color": "#f5f5f5"
              }
            ]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "administrative.land_parcel",
            "elementType": "labels",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "administrative.land_parcel",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#bdbdbd"
              },
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "poi",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#eeeeee"
              }
            ]
          },
          {
            "featureType": "poi",
            "elementType": "labels.text",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#757575"
              }
            ]
          },
          {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#e5e5e5"
              }
            ]
          },
          {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#9e9e9e"
              }
            ]
          },
          {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#ffffff"
              }
            ]
          },
          {
            "featureType": "road",
            "elementType": "labels.icon",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "road.arterial",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#757575"
              }
            ]
          },
          {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#dadada"
              }
            ]
          },
          {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#616161"
              }
            ]
          },
          {
            "featureType": "road.local",
            "elementType": "labels",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "road.local",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#9e9e9e"
              }
            ]
          },
          {
            "featureType": "transit",
            "stylers": [
              {
                "visibility": "off"
              }
            ]
          },
          {
            "featureType": "transit.line",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#e5e5e5"
              }
            ]
          },
          {
            "featureType": "transit.station",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#eeeeee"
              }
            ]
          },
          {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [
              {
                "color": "#c9c9c9"
              }
            ]
          },
          {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [
              {
                "color": "#9e9e9e"
              }
            ]
          }
        ]
    });
    this.map = map;
    ko.applyBindings(new ViewModel());
}(this.map);

function mapsError() {
    window.alert('There was an error loading Google Maps');
}
