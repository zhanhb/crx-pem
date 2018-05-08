angular.module('mainApp', ['ngResource', 'ngAnimate', 'ngSanitize', 'ui.bootstrap']).controller('main', function ($scope, $resource) {
    function load() {
        main.get({page: pagination.page - 1, limit: pagination.limit}, function (data) {
            delete data.page;
            angular.extend(pagination, data);
        });
    }

    var pagination = $scope.pagination = {
        page: 1,
        limit: 100,
        pageChanged: load
    };
    var main = $resource('/');
    load();
});
