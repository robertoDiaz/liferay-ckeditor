/**
 * @license Copyright (c) 2003-2015, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or http://ckeditor.com/license
 */

'use strict';

( function() {
	CKEDITOR.plugins.add( 'uploadwidget', {
		lang: 'en', // %REMOVE_LINE_CORE%
		requires: 'widget,clipboard,filetools,notificationaggregator',

		init: function( editor ) {
			// Images which should be changed into upload widget needs to be marked with `data-widget` on paste,
			// because otherwise wrong widget may handle upload placeholder element (e.g. image2 plugin would handle image).
			// `data-widget` attribute is allowed only in the elements which has also `data-cke-upload-id` attribute.
			editor.filter.allow( '*[!data-widget,!data-cke-upload-id]' );
		}
	} );

	/**
	 * This function creates an upload widget - a placeholder to show the the progress of an upload. The upload widget
	 * is based on its {@link CKEDITOR.fileTools.uploadWidgetDefinition definition}. `addUploadWidget` function also
	 * creates a paste event, if {@link CKEDITOR.fileTools.uploadWidgetDefinition#fileToElement fileToElement} method
	 * is defined. This event is helpful to handle pasted files, it will automatically check if files were pasted and
	 * and mark them to be uploaded.
	 *
	 * Upload widget helps to handle content being asynchronously uploaded inside the editor. It solves problems such as:
	 * editing during upload, undo manager integration, getting data, removing or copying uploading element.
	 *
	 * To create upload widget you need to define two transformation methods:
	 *
	 * * {@link CKEDITOR.fileTools.uploadWidgetDefinition#fileToElement fileToElement} method which will be called on `paste`
	 * and transform file into placeholder,
	 * * {@link CKEDITOR.fileTools.uploadWidgetDefinition#onUploaded onUploaded} with
	 * {@link CKEDITOR.fileTools.uploadWidgetDefinition#replaceWith replaceWith} method which will be called to replace
	 * upload placeholder with the final HTML when upload is done.
	 * If you want to show an additional progress you can also define
	 * {@link CKEDITOR.fileTools.uploadWidgetDefinition#onLoading onLoading} and
	 * {@link CKEDITOR.fileTools.uploadWidgetDefinition#onUploading onUploading} methods.
	 *
	 * The simplest uploading widget which uploads file and creates a link to it, may looks like this:
	 *
	 * 		CKEDITOR.fileTools.addUploadWidget( editor, 'uploadfile', {
	 *			uploadUrl: CKEDITOR.fileTools.getUploadUrl( editor.config ),
	 *
	 *			fileToElement: function( file ) {
	 *				var a = new CKEDITOR.dom.element( 'a' );
	 *				a.setText( file.name );
	 *				a.setAttribute( 'href', '#' );
	 *				return a;
	 *			},
	 *
	 *			onUploaded: function( upload ) {
	 *				this.replaceWith( '<a href="' + upload.url + '" target="_blank">' + upload.fileName + '</a>' );
	 *			}
	 *		} );
	 *
	 * Upload widget use {@link CKEDITOR.fileTools.fileLoader} as a helper to upload file. {@link CKEDITOR.fileTools.fileLoader}
	 * instance is created when the file is pasted and proper method is called, by default it is
	 * {@link CKEDITOR.fileTools.fileLoader#loadAndUpload} method. If you want to use only `load`
	 * or only `upload` you can use {@link CKEDITOR.fileTools.uploadWidgetDefinition#loadMethod loadMethod} property.
	 *
	 * Note that if you want to handle a big file, e.g. a video, you may need to use `upload` instead of
	 * `loadAndUpload` because the file may be to too big to load it to the memory at once.
	 *
	 * Note that if you do not upload file you need to define {@link CKEDITOR.fileTools.uploadWidgetDefinition#onLoaded onLoaded}
	 * instead of {@link CKEDITOR.fileTools.uploadWidgetDefinition#onUploaded onUploaded}.
	 * For example, if you want to read the content of the file:
	 *
	 *		CKEDITOR.fileTools.addUploadWidget( editor, 'fileReader', {
	 *			loadMethod: 'load',
	 *			supportedTypes: /text\/(plain|html)/,
	 *
	 *			fileToElement: function( file ) {
	 *				var el = new CKEDITOR.dom.element( 'span' );
	 *				el.setText( '...' );
	 *				return el;
	 *			},
	 *
	 *			onLoaded: function( loader ) {
	 *				this.replaceWith( atob( loader.data.split( ',' )[ 1 ] ) );
	 *			}
	 *		} );
	 *
	 * Note that if you need a custom `paste` handling you need to mark pasted element to be changed into upload widget
	 * using {@link CKEDITOR.fileTools#markElement markElement}. For example, instead of `fileToElement` helper from the
	 * example above, `paste` listener can be created manually:
	 *
	 *	editor.on( 'paste', function( evt ) {
	 *		var file, i, el, loader;
	 *
	 *		for ( i = 0; i < evt.data.dataTransfer.getFilesCount(); i++ ) {
	 *			file = evt.data.dataTransfer.getFile( i );
	 *
	 *			if ( CKEDITOR.fileTools.isTypeSupported( file, /text\/(plain|html)/ ) ) {
	 *				el = new CKEDITOR.dom.element( 'span' ),
	 *				loader = editor.uploadsRepository.create( file );
	 *
	 *				el.setText( '...' );
	 *
	 *				loader.load();
	 *
	 *				fileTools.markElement( el, 'filereader', loader.id );
	 *
	 *				evt.data.dataValue += el.getOuterHtml();
	 *			}
	 *		}
	 *	} );
	 *
	 * Note that you can bind notifications to the upload widget on paste using
	 * {@link CKEDITOR.fileTools.bindNotifications bindNotifications} method, so notifications will automatically
	 * show the progress of the upload. Because this method show notification about upload do not use it if you only
	 * {@link CKEDITOR.fileTools.fileLoader#load load} (not upload) file.
	 *
	 *	editor.on( 'paste', function( evt ) {
	 *		var file, i, el, loader;
	 *
	 *		for ( i = 0; i < evt.data.dataTransfer.getFilesCount(); i++ ) {
	 *			file = evt.data.dataTransfer.getFile( i );
	 *
	 *			if ( CKEDITOR.fileTools.isTypeSupported( file, /text\/pdf/ ) ) {
	 *				el = new CKEDITOR.dom.element( 'span' ),
	 *				loader = editor.uploadsRepository.create( file );
	 *
	 *				el.setText( '...' );
	 *
	 *				loader.upload();
	 *
	 *				fileTools.markElement( el, 'pdfuploader', loader.id );
	 *
	 *				fileTools.bindNotifications( editor, loader );
	 *
	 *				evt.data.dataValue += el.getOuterHtml();
	 *			}
	 *		}
	 *	} );
	 *
	 * @member CKEDITOR.fileTools
	 * @param {CKEDITOR.editor} editor The editor instance.
	 * @param {String} name The name of the upload widget.
	 * @param {CKEDITOR.fileTools.uploadWidgetDefinition} def Upload widget definition.
	 */
	function addUploadWidget( editor, name, def ) {
		var fileTools = CKEDITOR.fileTools,
			uploads = editor.uploadsRepository,
			// Plugins which support all file type has lower priority than plugins which support specific types.
			priority = def.supportedTypes ? 10 : 20;

		if ( def.fileToElement ) {
			editor.on( 'paste', function( evt ) {
				var data = evt.data,
					dataTransfer = data.dataTransfer,
					filesCount = dataTransfer.getFilesCount(),
					loadMethod = def.loadMethod || 'loadAndUpload',
					file, i;

				if ( data.dataValue || !filesCount ) {
					return;
				}

				for ( i = 0; i < filesCount; i++ ) {
					file = dataTransfer.getFile( i );

					// No def.supportedTypes means all types are supported.
					if ( !def.supportedTypes || fileTools.isTypeSupported( file, def.supportedTypes ) ) {
						var el = def.fileToElement( file ),
							loader = uploads.create( file );

						if ( el ) {
							loader[ loadMethod ]( def.uploadUrl );

							CKEDITOR.fileTools.markElement( el, name, loader.id );

							if ( loadMethod == 'loadAndUpload' || loadMethod == 'upload' ) {
								CKEDITOR.fileTools.bindNotifications( editor, loader );
							}

							data.dataValue += el.getOuterHtml();
						}
					}
				}
			}, null, null, priority );
		}

		/**
		 * This is an abstract class that describes a definition of an upload widget.
		 * It is a type of {@link CKEDITOR.fileTools#addUploadWidget} method's second argument.
		 *
		 * Note that, because upload widget is a type of a widget, this definition extends
		 * {@link CKEDITOR.plugins.widget.definition}.
		 * It adds several new properties and callbacks and implements the {@link CKEDITOR.plugins.widget.definition#downcast}
		 * and {@link CKEDITOR.plugins.widget.definition#init} callbacks. These two properties
		 * should not be overwritten.
		 *
		 * Also, upload widget definition defines few properties ({@link #fileToElement}, {@link #supportedTypes},
		 * {@link #loadMethod loadMethod} and {@link #uploadUrl}) used in the {@link CKEDITOR.editor#paste} listener
		 * which is registered by {@link CKEDITOR.fileTools#addUploadWidget} if the upload widget definition contains
		 * {@link #fileToElement} callback.
		 *
		 * @abstract
		 * @class CKEDITOR.fileTools.uploadWidgetDefinition
		 * @mixins CKEDITOR.plugins.widget.definition
		 */
		CKEDITOR.tools.extend( def, {
			/**
			 * Upload widget definition overwrites {@link CKEDITOR.plugins.widget.definition#downcast} property.
			 * This should not be changed.
			 *
			 * @property {String/Function}
			 */
			downcast: function() {
				return new CKEDITOR.htmlParser.text( '' );
			},

			/**
			 * Upload widget definition overwrites {@link CKEDITOR.plugins.widget.definition#init}.
			 * If you want to add some code in the `init` callback remember to call the base function.
			 *
			 * @property {Function}
			 */
			init: function() {
				var widget = this,
					id = this.wrapper.findOne( '[data-cke-upload-id]' ).data( 'cke-upload-id' ),
					loader = uploads.loaders[ id ],
					capitalize = CKEDITOR.tools.capitalize,
					oldStyle, newStyle;

				loader.on( 'update', function( evt ) {
					// Abort if widget was removed.
					if ( !widget.wrapper || !widget.wrapper.getParent() ) {
						if ( !editor.editable().find( '[data-cke-upload-id="' + id + '"]' ).count() ) {
							loader.abort();
						}
						evt.removeListener();
						return;
					}

					editor.fire( 'lockSnapshot' );

					// Call users method, eg. if the status is `uploaded` then
					// `onUploaded` method will be called, if exists.
					var methodName = 'on' + capitalize( loader.status );

					if ( typeof widget[ methodName ] === 'function' ) {
						if ( widget[ methodName ]( loader ) === false ) {
							editor.fire( 'unlockSnapshot' );
							return;
						}
					}

					// Set style to the wrapper if it still exists.
					newStyle = 'cke_upload_' + loader.status;
					if ( widget.wrapper && newStyle != oldStyle ) {
						oldStyle && widget.wrapper.removeClass( oldStyle );
						widget.wrapper.addClass( newStyle );
						oldStyle = newStyle;
					}

					// Remove widget on error or abort.
					if ( loader.status == 'error' || loader.status == 'abort' ) {
						editor.widgets.del( widget );
					}

					editor.fire( 'unlockSnapshot' );
				} );

				loader.update();
			},

			/**
			 * Replaces upload widget with the final HTML. This method should be called when upload is done,
			 * in common case in the {@link #onUploaded} callback.
			 *
			 * @property {Function}
			 * @param {String} data HTML to replace the upload widget.
			 * @param {String} [mode='html'] See {@link CKEDITOR.editor#method-insertHtml}'s modes.
			 */
			replaceWith: function( data, mode ) {
				if ( data.trim() === '' ) {
					editor.widgets.del( this );
					return;
				}

				var wasSelected = ( this == editor.widgets.focused ),
					editable = editor.editable(),
					range = editor.createRange(),
					bookmark, bookmarks;

				if ( !wasSelected ) {
					bookmarks = editor.getSelection().createBookmarks();
				}

				range.setStartBefore( this.wrapper );
				range.setEndAfter( this.wrapper );

				if ( wasSelected ) {
					bookmark = range.createBookmark();
				}

				editable.insertHtmlIntoRange( data, range, mode );

				editor.widgets.checkWidgets( { initOnlyNew: true } );

				// Ensure that old widgets instance will be removed.
				// If replaceWith is called in init, because of paste then checkWidgets will not remove it.
				editor.widgets.destroy( this, true );

				if ( wasSelected ) {
					range.moveToBookmark( bookmark );
					range.select();
				} else {
					editor.getSelection().selectBookmarks( bookmarks );
				}

			}

			/**
			 * If this property is defined, paste listener is created to transform pasted file into HTML element.
			 * It creates HTML element which will be then transformed into an upload widget.
			 * It is only called for {@link #supportedTypes supported files}.
			 * If multiple files have been pasted this function will be called for each file of supported type.
			 *
			 * @property {Function} fileToElement
			 * @param {Blob} file Pasted file to load or upload.
			 * @returns {CKEDITOR.dom.element} Element which will be transformed into the upload widget.
			 */

			/**
			 * Regular expression to check if the file type is supported by this widget.
			 * If not defined all files will be handled.
			 *
			 * @property {String} [supportedTypes]
			 */

			/**
			 * URL to which the file will be uploaded. It should be taken from configuration using
			 * {@link CKEDITOR.fileTools#getUploadUrl}.
			 *
			 * @property {String} [uploadUrl]
			 */

			/**
			 * What type of loading operation should be executed as a result of pasting file. Possible options are:
			 *
			 * * 'loadAndUpload' - default behavior, {@link CKEDITOR.fileTools.fileLoader#loadAndUpload} method will be
			 * executed, file will be loaded first and uploaded immediately after loading is done,
			 * * 'load' - {@link CKEDITOR.fileTools.fileLoader#load} method will be executed, this loading type should
			 * be used if you want only load file data without uploading it,
			 * * 'upload' - {@link CKEDITOR.fileTools.fileLoader#upload} method will be executed, file will be uploaded,
			 * without loading it to the memory, this loading type should be used if you want to upload big file,
			 * otherwise you can meet out of memory error.
			 *
			 * @property {String} [loadMethod=loadAndUpload]
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `loading`.
			 *
			 * @property {Function} [onLoading]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean}
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `loaded`.
			 *
			 * @property {Function} [onLoaded]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean}
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `uploading`.
			 *
			 * @property {Function} [onUploading]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean}
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `uploaded`.
			 * At that point upload is done and the uploading widget should we replaced with the final HTML using
			 * {@link #replaceWith} method.
			 *
			 * @property {Function} [onUploaded]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean}
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `error`.
			 * The default behavior is to remove the widget and it can be canceled if this function returns `false`.
			 *
			 * @property {Function} [onError]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean} If `false` default behavior (remove widget) will be canceled.
			 */

			/**
			 * Function called when the {@link CKEDITOR.fileTools.fileLoader#status status} of the upload changes to `abort`.
			 * The default behavior is to remove the widget and it can be canceled if this function returns `false`.
			 *
			 * @property {Function} [onAbort]
			 * @param {CKEDITOR.fileTools.fileLoader} loader Loaders instance.
			 * @returns {Boolean} If `false` default behavior (remove widget) will be canceled.
			 */
		} );

		editor.widgets.add( name, def );
	}

	/**
	 * Marks element which should be transformed into an upload widget.
	 *
	 * @see CKEDITOR.fileTools.addUploadWidget
	 *
	 * @member CKEDITOR.fileTools
	 * @param {CKEDITOR.dom.element} element Element to be marked.
	 * @param {String} widgetName Name of the upload widget.
	 * @param {Number} loaderId The id of a related {@link CKEDITOR.fileTools.fileLoader}.
	 */
	function markElement( element, widgetName, loaderId  ) {
		element.setAttributes( {
			'data-cke-upload-id': loaderId,
			'data-widget': widgetName
		} );
	}

	/**
	 * Binds notification to the {@link CKEDITOR.fileTools.fileLoader file loader} so the upload widget will use
	 * notification to show the status and progress.
	 * This function uses {@link CKEDITOR.plugins.notificationAggregator}, so even if multiple files are uploading
	 * only one notification is shown. The exception are warnings, because they are shown in the separate notifications.
	 * This notification show only progress of the upload so this method should not be used if
	 * {@link CKEDITOR.fileTools.fileLoader#load loader.load} method was called, it works with
	 * {@link CKEDITOR.fileTools.fileLoader#upload upload} and {@link CKEDITOR.fileTools.fileLoader#loadAndUpload loadAndUpload}.
	 *
	 * @param {CKEDITOR.editor} editor The editor instance.
	 * @param {CKEDITOR.fileTools.fileLoader} loader The fileLoader instance.
	 */
	function bindNotifications( editor, loader ) {
		var aggregator = editor._.uploadWidgetNotificaionAggregator;

		// Create one notification agregator for all types of upload widgets for editor.
		if ( !aggregator || aggregator.isFinished() ) {
			aggregator = editor._.uploadWidgetNotificaionAggregator = new CKEDITOR.plugins.notificationAggregator(
				editor, editor.lang.uploadwidget.uploadMany, editor.lang.uploadwidget.uploadOne );

			aggregator.once( 'finished', function() {
				var tasks = aggregator.getTaskCount();

				if ( tasks === 0 ) {
					aggregator.notification.hide();
				} else {
					aggregator.notification.update( {
						message: tasks == 1 ?
							editor.lang.uploadwidget.doneOne :
							editor.lang.uploadwidget.doneMany.replace( '%1', tasks ),
						type: 'success'
					} );
				}
			} );
		}

		var task = aggregator.createTask( { weight: loader.total } );

		loader.on( 'update', function() {
			if ( task && loader.status == 'uploading' ) {
				task.update( loader.uploaded );
			}
		} );

		loader.on( 'uploaded', function() {
			task && task.done();
		} );

		loader.on( 'error', function() {
			task && task.cancel();
			editor.showNotification( loader.message, 'warning' );
		} );

		loader.on( 'abort', function() {
			task && task.cancel();
			editor.showNotification( editor.lang.uploadwidget.abort, 'info' );
		} );
	}

	// Two plugins extends this object.
	if ( !CKEDITOR.fileTools ) {
		CKEDITOR.fileTools = {};
	}

	CKEDITOR.tools.extend( CKEDITOR.fileTools, {
		addUploadWidget: addUploadWidget,
		markElement: markElement,
		bindNotifications: bindNotifications
	} );
} )();