angular.module('mainApp', ['ngResource', 'ngAnimate', 'ngSanitize', 'ui.bootstrap']).controller('main', function ($scope, $resource) {
    var pagination = $scope.pagination = {
        page: 1,
        total: 100,
        totalPages: 0,
        pageChanged() {
            main.get({page: pagination.page - 1, limit: 100}, function (data) {
                delete data.page;
                angular.extend(pagination, data);
            });
        }
    };
    var main = $resource('/');
    main.get({offset: 0, limit: 100}, function (data) {
        delete data.page;
        angular.extend(pagination, data);
    });
});
