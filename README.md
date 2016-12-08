# Unused Selectors
Command line utility for finding unused CSS/SASS selectors


#### Installation

npm install -g unused-selectors


# Usage

## From the command line

run 

`unused-selector [directory-path] [output-file-path]`

and it will return a list of selectors present in your css/scss/sass source files that are absent in your html source files.  It is important to note that selectors that override non-source-file html (such as other packages) or dynamically generated classes/ids in your html may not be correctly matched.

##Arguments

By default the module will search for all html and css/scss/sass files in the current directory.  If you include a `directory-path` it will only search files in that directory and its subdirectories.

If the resulting unused selectors are very few, it will print them in a list to the command line.  If there are many, it will write the list to a file.  By default that file will be `./unused-selectors.txt`, but any file/path can be included as `output-file-path`.




#### Current features

Classes and IDs are currently supported selectors.
Dynamically added classes via Angular's `ng-class` are supported.
